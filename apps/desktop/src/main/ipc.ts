import { readdir } from 'node:fs/promises'
import { basename } from 'node:path'
import { dialog, ipcMain, shell } from 'electron'
import {
  DatIndex,
  executePlan,
  planRenames,
  readJournal,
  scanDirectory,
  undoFromJournal,
  type Identification,
  type SystemRegistry,
} from '@romorg/core'
import type { DatCache } from './dat-cache.ts'
import { loadLocalDat } from './dat-cache.ts'
import { journalDirFor, type Library, type LibraryStore } from './libraries.ts'
import type {
  ApplyResultDto,
  JournalSummary,
  PlanDto,
  PlanOptionsDto,
  ScanProgress,
  ScanRow,
  ScanSummaryDto,
  UndoResultDto,
} from './ipc-types.ts'

/**
 * Estado vivo de uma biblioteca entre o scan e a aplicação.
 *
 * Os `Identification` completos ficam aqui, no processo que tem acesso a disco. O renderer
 * recebe só os DTOs e devolve ids — nunca caminhos que ele mesmo possa ter construído.
 */
interface LibraryState {
  identifications: Map<string, Identification>
  order: string[]
  controller: AbortController | null
}

function rowIdOf(identification: Identification): string {
  return identification.archiveEntry === undefined
    ? identification.filePath
    : `${identification.filePath}›${identification.archiveEntry}`
}

function toRow(identification: Identification): ScanRow {
  return {
    id: rowIdOf(identification),
    fileName: identification.fileName,
    archiveEntry: identification.archiveEntry ?? null,
    method: identification.method,
    proposedName: identification.proposedName,
    ambiguous: identification.ambiguous,
    candidates: [...new Set(identification.matches.map((match) => match.gameName))],
    fromArchiveIndex: identification.fromArchiveIndex === true,
    headerStripped: identification.method === 'hash-headerless',
    byteOrderVariant: identification.byteOrder.variantId,
  }
}

export function registerIpc(
  registry: SystemRegistry,
  libraries: LibraryStore,
  datCache: DatCache,
): void {
  const states = new Map<string, LibraryState>()

  function stateOf(libraryId: string): LibraryState {
    let state = states.get(libraryId)
    if (state === undefined) {
      state = { identifications: new Map(), order: [], controller: null }
      states.set(libraryId, state)
    }
    return state
  }

  async function requireLibrary(libraryId: string): Promise<Library> {
    const library = await libraries.get(libraryId)
    if (library === undefined) throw new Error(`biblioteca desconhecida: ${libraryId}`)
    return library
  }

  ipcMain.handle('systems:list', () => registry.all())

  ipcMain.handle('libraries:list', () => libraries.list())

  ipcMain.handle('libraries:choose', async (_event, systemId: string) => {
    if (registry.get(systemId) === undefined) throw new Error(`sistema desconhecido: ${systemId}`)

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: 'Escolha a pasta com as ROMs deste console',
    })
    if (result.canceled || result.filePaths[0] === undefined) return null

    return libraries.add(systemId, result.filePaths[0])
  })

  ipcMain.handle(
    'libraries:update',
    (_event, id: string, changes: { recursive?: boolean; template?: string }) =>
      libraries.update(id, changes),
  )

  ipcMain.handle('libraries:remove', async (_event, id: string) => {
    states.delete(id)
    await libraries.remove(id)
  })

  ipcMain.handle('libraries:reveal', async (_event, id: string) => {
    const library = await requireLibrary(id)
    await shell.openPath(library.directory)
  })

  ipcMain.handle(
    'scan:start',
    async (
      event,
      libraryId: string,
      options: { useLibretro: boolean; localDatPaths: string[] },
    ) => {
      const library = await requireLibrary(libraryId)
      const system = registry.get(library.systemId)
      if (system === undefined) throw new Error(`sistema desconhecido: ${library.systemId}`)

      const state = stateOf(libraryId)
      state.controller?.abort()
      const controller = new AbortController()
      state.controller = controller

      const index = new DatIndex()
      try {
        if (options.useLibretro) {
          for (const dat of await datCache.getFor(system)) index.importDat(dat)
        }
        for (const path of options.localDatPaths) {
          index.importDat(await loadLocalDat(path))
        }

        const summary = await scanDirectory(library.directory, system, index, {
          recursive: library.recursive,
          ...(library.template !== undefined &&
            library.template !== '' && {
              template: library.template,
            }),
          signal: controller.signal,
          onProgress: (done, total, current) => {
            const progress: ScanProgress = {
              libraryId,
              done,
              total,
              currentFile: current.fileName,
            }
            event.sender.send('scan:progress', progress)
          },
        })

        state.identifications = new Map(
          summary.results.map((identification) => [rowIdOf(identification), identification]),
        )
        state.order = summary.results.map(rowIdOf)

        const dto: ScanSummaryDto = {
          libraryId,
          rows: summary.results.map(toRow),
          failures: summary.failures,
        }
        return dto
      } finally {
        index.close()
        if (state.controller === controller) state.controller = null
      }
    },
  )

  ipcMain.handle('scan:cancel', (_event, libraryId: string) => {
    stateOf(libraryId).controller?.abort()
  })

  ipcMain.handle('plan:build', async (_event, libraryId: string, options: PlanOptionsDto) => {
    const state = stateOf(libraryId)
    const identifications = state.order
      .map((id) => state.identifications.get(id))
      .filter((value): value is Identification => value !== undefined)

    const plan = planRenames(identifications, {
      includeFilenameMatches: options.includeFilenameMatches,
      allowAmbiguous: options.allowAmbiguous,
      existingPaths: identifications.map((identification) => identification.filePath),
    })

    const dto: PlanDto = {
      operations: plan.operations.map((operation) => ({
        id: rowIdOf(operation.identification),
        from: operation.from,
        to: operation.to,
      })),
      skipped: plan.skipped.map((entry) => ({
        id: rowIdOf(entry.identification),
        fileName: entry.identification.fileName,
        reason: entry.reason,
        detail: entry.detail ?? null,
      })),
    }
    return dto
  })

  /**
   * Aplica o plano.
   *
   * O plano é remontado aqui a partir do estado do main, e não recebido do renderer: aceitar
   * uma lista de caminhos vinda da interface significaria renomear o que ela mandasse.
   * O renderer manda `selectedIds`, e o main decide o que isso quer dizer em disco.
   */
  ipcMain.handle(
    'plan:apply',
    async (
      _event,
      libraryId: string,
      options: PlanOptionsDto,
      selectedIds: string[] | null,
    ): Promise<ApplyResultDto> => {
      const library = await requireLibrary(libraryId)
      const state = stateOf(libraryId)

      const identifications = state.order
        .map((id) => state.identifications.get(id))
        .filter((value): value is Identification => value !== undefined)

      const plan = planRenames(identifications, {
        includeFilenameMatches: options.includeFilenameMatches,
        allowAmbiguous: options.allowAmbiguous,
        existingPaths: identifications.map((identification) => identification.filePath),
      })

      const selected = selectedIds === null ? null : new Set(selectedIds)
      const operations =
        selected === null
          ? plan.operations
          : plan.operations.filter((operation) => selected.has(rowIdOf(operation.identification)))

      const result = await executePlan(
        { operations, skipped: plan.skipped },
        { journalDir: journalDirFor(library) },
      )

      return {
        applied: result.applied.length,
        failed: result.failed.map((failure) => ({ from: failure.from, reason: failure.reason })),
        journalPath: result.journalPath,
      }
    },
  )

  ipcMain.handle('journals:list', async (_event, libraryId: string): Promise<JournalSummary[]> => {
    const library = await requireLibrary(libraryId)
    const directory = journalDirFor(library)

    let entries: string[]
    try {
      entries = await readdir(directory)
    } catch {
      return []
    }

    const summaries = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.jsonl'))
        .map(async (entry) => {
          const path = `${directory}/${entry}`
          const records = await readJournal(path)
          return {
            path,
            fileName: basename(path),
            operations: records.length,
            at: records[0]?.at ?? '',
          }
        }),
    )

    return summaries.sort((left, right) => right.fileName.localeCompare(left.fileName))
  })

  ipcMain.handle('journals:undo', async (_event, journalPath: string): Promise<UndoResultDto> => {
    const result = await undoFromJournal(journalPath)
    return {
      restored: result.restored.length,
      failed: result.failed.map((failure) => ({ from: failure.from, reason: failure.reason })),
    }
  })

  ipcMain.handle('dats:chooseLocal', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'DAT', extensions: ['dat', 'xml'] }],
      message: 'Escolha os arquivos DAT a usar',
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dats:status', () => datCache.status())
}
