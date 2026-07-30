import { contextBridge, ipcRenderer } from 'electron'
import type { SystemRulePack } from '@romorg/core'
import type { Library, LibraryChanges } from '../main/libraries.ts'
import type {
  ApplyResultDto,
  JournalSummary,
  ApplyProgress,
  PlanOptionsDto,
  PlanResultDto,
  ScanProgress,
  ScanSummaryDto,
  UndoResultDto,
} from '../main/ipc-types.ts'

/**
 * Única ponte entre renderer e disco.
 *
 * A superfície é deliberadamente estreita e fala em **ids**, não em caminhos: o renderer não
 * consegue pedir para renomear um arquivo arbitrário, só para aplicar o plano que o main
 * calculou a partir do próprio scan.
 */
const api = {
  /** A janela usa titleBarStyle 'hiddenInset' no macOS; a interface precisa saber disso. */
  platform: process.platform,

  listSystems: (): Promise<SystemRulePack[]> => ipcRenderer.invoke('systems:list'),

  libraries: {
    list: (): Promise<Library[]> => ipcRenderer.invoke('libraries:list'),
    choose: (systemId: string): Promise<Library | null> =>
      ipcRenderer.invoke('libraries:choose', systemId),
    update: (id: string, changes: LibraryChanges): Promise<Library | undefined> =>
      ipcRenderer.invoke('libraries:update', id, changes),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('libraries:remove', id),
    reveal: (id: string): Promise<void> => ipcRenderer.invoke('libraries:reveal', id),
  },

  scan: {
    start: (
      libraryId: string,
      options: { useLibretro: boolean; localDatPaths: string[] },
    ): Promise<ScanSummaryDto> => ipcRenderer.invoke('scan:start', libraryId, options),
    cancel: (libraryId: string): Promise<void> => ipcRenderer.invoke('scan:cancel', libraryId),
    /** Último resultado da biblioteca, da memória ou do disco. `null` se nunca houve. */
    restore: (libraryId: string): Promise<ScanSummaryDto | null> =>
      ipcRenderer.invoke('scan:restore', libraryId),
    onProgress: (listener: (progress: ScanProgress) => void): (() => void) => {
      const handler = (_event: unknown, progress: ScanProgress): void => listener(progress)
      ipcRenderer.on('scan:progress', handler)
      return () => ipcRenderer.off('scan:progress', handler)
    },
  },

  plan: {
    build: (libraryId: string, options: PlanOptionsDto): Promise<PlanResultDto> =>
      ipcRenderer.invoke('plan:build', libraryId, options),
    apply: (
      libraryId: string,
      options: PlanOptionsDto,
      selectedIds: string[] | null,
    ): Promise<ApplyResultDto> => ipcRenderer.invoke('plan:apply', libraryId, options, selectedIds),
    cancel: (libraryId: string): Promise<void> => ipcRenderer.invoke('apply:cancel', libraryId),
    onProgress: (listener: (progress: ApplyProgress) => void): (() => void) => {
      const handler = (_event: unknown, progress: ApplyProgress): void => listener(progress)
      ipcRenderer.on('apply:progress', handler)
      return () => ipcRenderer.off('apply:progress', handler)
    },
  },

  journals: {
    list: (libraryId: string): Promise<JournalSummary[]> =>
      ipcRenderer.invoke('journals:list', libraryId),
    undo: (journalPath: string): Promise<UndoResultDto> =>
      ipcRenderer.invoke('journals:undo', journalPath),
  },

  icons: {
    forSystems: (systemIds: string[]): Promise<Record<string, string | null>> =>
      ipcRenderer.invoke('icons:forSystems', systemIds),
  },

  dats: {
    chooseLocal: (): Promise<string[]> => ipcRenderer.invoke('dats:chooseLocal'),
    status: (): Promise<{ systemId: string; updatedAt: string }[]> =>
      ipcRenderer.invoke('dats:status'),
  },
}

export type RomOrgApi = typeof api

contextBridge.exposeInMainWorld('romorg', api)
