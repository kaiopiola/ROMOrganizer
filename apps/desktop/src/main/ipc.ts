import { readdir } from 'node:fs/promises'
import { basename } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import {
  DatIndex,
  executePlan,
  HashCache,
  planRenames,
  readJournal,
  reproposeName,
  scanDirectory,
  undoFromJournal,
  type Identification,
  type SystemRegistry,
} from '@romorg/core'
import type { DatCache } from './dat-cache.ts'
import type { IconCache } from './icon-cache.ts'
import { ScanSnapshot } from './scan-snapshot.ts'
import { loadLocalDat } from './dat-cache.ts'
import {
  hashCachePathFor,
  journalDirFor,
  type Library,
  type LibraryChanges,
  type LibraryStore,
  scanSnapshotPathFor,
} from './libraries.ts'
import type {
  ApplyResultDto,
  JournalSummary,
  ApplyProgress,
  PlanDto,
  PlanOptionsDto,
  PlanResultDto,
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
  /** Scan e aplicação são canceláveis de forma independente. */
  scanController: AbortController | null
  applyController: AbortController | null
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

/**
 * Confirmação nativa antes de escrever em disco.
 *
 * O texto fica aqui em vez de vir do renderer para a decisão e a mensagem não se separarem —
 * o idioma sai do próprio sistema.
 */
async function confirmApply(event: IpcMainInvokeEvent, count: number): Promise<boolean> {
  const isPortuguese = app.getLocale().toLowerCase().startsWith('pt')
  const plural = count === 1 ? '' : 's'

  const options = {
    type: 'question' as const,
    buttons: isPortuguese ? ['Cancelar', 'Renomear'] : ['Cancel', 'Rename'],
    // O botão seguro é o padrão, e Esc cancela.
    defaultId: 1,
    cancelId: 0,
    message: isPortuguese
      ? `Renomear ${count} arquivo${plural}?`
      : `Rename ${count} file${count === 1 ? '' : 's'}?`,
    detail: isPortuguese
      ? 'Dá para desfazer depois, pelo histórico.'
      : 'This can be undone later from the history.',
  }

  const window = BrowserWindow.fromWebContents(event.sender)
  const result =
    window === null
      ? await dialog.showMessageBox(options)
      : await dialog.showMessageBox(window, options)

  return result.response === 1
}

export function registerIpc(
  registry: SystemRegistry,
  libraries: LibraryStore,
  datCache: DatCache,
  iconCache: IconCache,
): void {
  const states = new Map<string, LibraryState>()

  function stateOf(libraryId: string): LibraryState {
    let state = states.get(libraryId)
    if (state === undefined) {
      state = {
        identifications: new Map(),
        order: [],
        scanController: null,
        applyController: null,
      }
      states.set(libraryId, state)
    }
    return state
  }

  /** Vazio ou só espaços significa: recurso desligado. */
  function optional(value: string): string | undefined {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }

  /** Traduz as opções da interface para o que o planner entende. */
  function planOptionsFor(
    library: Library,
    options: PlanOptionsDto,
    identifications: Identification[],
  ) {
    const template = optional(options.template)
    const quarantineDirectory = optional(options.quarantineDirectory)

    return {
      includeFilenameMatches: options.includeFilenameMatches,
      allowAmbiguous: options.allowAmbiguous,
      existingPaths: identifications.map((identification) => identification.filePath),
      rootDirectory: library.directory,
      ...(template !== undefined && { template }),
      ...(quarantineDirectory !== undefined && { quarantineDirectory }),
    }
  }

  function identificationsOf(state: LibraryState): Identification[] {
    return state.order
      .map((id) => state.identifications.get(id))
      .filter((value): value is Identification => value !== undefined)
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

  ipcMain.handle('libraries:update', async (_event, id: string, changes: LibraryChanges) => {
    const updated = await libraries.update(id, changes)

    // Definir o padrão de nomes vale para o console, não só para esta pasta: a próxima
    // biblioteca do mesmo sistema já começa do jeito que o usuário escolheu.
    if (changes.template !== undefined && updated !== undefined) {
      await libraries.setSystemTemplate(updated.systemId, changes.template)
    }

    return updated
  })

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
      state.scanController?.abort()
      const controller = new AbortController()
      state.scanController = controller

      const index = new DatIndex()
      const cachePath = hashCachePathFor(library)
      const hashCache = await HashCache.load(cachePath)

      try {
        if (options.useLibretro) {
          for (const dat of await datCache.getFor(system)) index.importDat(dat)
        }
        for (const path of options.localDatPaths) {
          index.importDat(await loadLocalDat(path))
        }

        const summary = await scanDirectory(library.directory, system, index, {
          recursive: library.recursive,
          hashCache,
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

        // Cada rename cria uma chave nova; sem podar, o cache cresceria a cada aplicação.
        hashCache.retainOnly(summary.results.map((identification) => identification.filePath))
        await hashCache.save(cachePath)
        await ScanSnapshot.save(scanSnapshotPathFor(library), summary.results)

        const dto: ScanSummaryDto = {
          libraryId,
          rows: summary.results.map(toRow),
          failures: summary.failures,
        }
        return dto
      } finally {
        index.close()
        if (state.scanController === controller) state.scanController = null
      }
    },
  )

  ipcMain.handle('scan:cancel', (_event, libraryId: string) => {
    stateOf(libraryId).scanController?.abort()
  })

  /**
   * Recupera o último resultado de identificação da biblioteca.
   *
   * Primeiro o estado em memória, que é o mais recente; depois o snapshot em disco, para
   * reabrir o app não significar tela vazia numa coleção já identificada. Devolve `null`
   * quando não há nada — aí só resta identificar.
   */
  ipcMain.handle('scan:restore', async (_event, libraryId: string) => {
    const library = await requireLibrary(libraryId)
    const state = stateOf(libraryId)

    if (state.order.length > 0) {
      return {
        libraryId,
        rows: identificationsOf(state).map(toRow),
        failures: [],
        restored: true,
        stale: false,
      }
    }

    const snapshot = await ScanSnapshot.load(scanSnapshotPathFor(library), registry)
    if (snapshot === null) return null

    state.identifications = new Map(
      snapshot.identifications.map((identification) => [rowIdOf(identification), identification]),
    )
    state.order = snapshot.identifications.map(rowIdOf)

    return {
      libraryId,
      rows: snapshot.identifications.map(toRow),
      failures: [],
      restored: true,
      stale: snapshot.stale,
    }
  })

  ipcMain.handle('apply:cancel', (_event, libraryId: string) => {
    stateOf(libraryId).applyController?.abort()
  })

  ipcMain.handle('plan:build', async (_event, libraryId: string, options: PlanOptionsDto) => {
    const library = await requireLibrary(libraryId)
    const state = stateOf(libraryId)
    const identifications = identificationsOf(state)
    const template = optional(options.template)

    const plan = planRenames(identifications, planOptionsFor(library, options, identifications))
    const quarantineTargets = new Set(
      plan.operations
        .filter((operation) => operation.identification.proposedName === null)
        .map((operation) => operation.to),
    )

    const dto: PlanDto = {
      operations: plan.operations.map((operation) => ({
        id: rowIdOf(operation.identification),
        from: operation.from,
        to: operation.to,
        quarantine: quarantineTargets.has(operation.to),
      })),
      skipped: plan.skipped.map((entry) => ({
        id: rowIdOf(entry.identification),
        fileName: entry.identification.fileName,
        reason: entry.reason,
        detail: entry.detail ?? null,
      })),
    }

    // As linhas acompanham o plano: um nome proposto na tabela que não bate com o que o
    // plano fará seria a pior forma de o usuário aprovar a coisa errada.
    const result: PlanResultDto = {
      plan: dto,
      rows: identifications.map((identification) => toRow(reproposeName(identification, template))),
    }
    return result
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
      event,
      libraryId: string,
      options: PlanOptionsDto,
      selectedIds: string[] | null,
    ): Promise<ApplyResultDto> => {
      const library = await requireLibrary(libraryId)
      const state = stateOf(libraryId)
      const identifications = identificationsOf(state)
      const plan = planRenames(identifications, planOptionsFor(library, options, identifications))

      const selected = selectedIds === null ? null : new Set(selectedIds)
      const operations =
        selected === null
          ? plan.operations
          : plan.operations.filter((operation) => selected.has(rowIdOf(operation.identification)))

      if (operations.length === 0) {
        return { applied: 0, failed: [], journalPath: null, cancelled: false }
      }

      // A confirmação acontece aqui, e não no renderer, por dois motivos: `window.confirm`
      // não é confiável no Electron, e a última barreira antes de escrever em disco não deve
      // depender da camada que não tem acesso a disco.
      if (!(await confirmApply(event, operations.length))) {
        return { applied: 0, failed: [], journalPath: null, cancelled: true }
      }

      const controller = new AbortController()
      state.applyController = controller

      const result = await executePlan(
        { operations, skipped: plan.skipped },
        {
          journalDir: journalDirFor(library),
          signal: controller.signal,
          onProgress: (done, total, operation) => {
            const progress: ApplyProgress = {
              libraryId,
              done,
              total,
              currentFile: operation.identification.fileName,
            }
            event.sender.send('apply:progress', progress)
          },
        },
      )

      if (state.applyController === controller) state.applyController = null

      return {
        applied: result.applied.length,
        failed: result.failed.map((failure) => ({ from: failure.from, reason: failure.reason })),
        journalPath: result.journalPath,
        cancelled: result.cancelled,
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

  ipcMain.handle('icons:forSystems', async (_event, systemIds: string[]) => {
    const entries = await Promise.all(
      systemIds.map(async (systemId) => {
        const system = registry.get(systemId)
        return [systemId, system === undefined ? null : await iconCache.getFor(system)] as const
      }),
    )
    return Object.fromEntries(entries)
  })
}
