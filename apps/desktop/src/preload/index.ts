import { contextBridge, ipcRenderer } from 'electron'
import type { SystemRulePack } from '@romorg/core'
import type { Library } from '../main/libraries.ts'
import type {
  ApplyResultDto,
  JournalSummary,
  PlanDto,
  PlanOptionsDto,
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
  listSystems: (): Promise<SystemRulePack[]> => ipcRenderer.invoke('systems:list'),

  libraries: {
    list: (): Promise<Library[]> => ipcRenderer.invoke('libraries:list'),
    choose: (systemId: string): Promise<Library | null> =>
      ipcRenderer.invoke('libraries:choose', systemId),
    update: (id: string, changes: { recursive?: boolean }): Promise<Library | undefined> =>
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
    onProgress: (listener: (progress: ScanProgress) => void): (() => void) => {
      const handler = (_event: unknown, progress: ScanProgress): void => listener(progress)
      ipcRenderer.on('scan:progress', handler)
      return () => ipcRenderer.off('scan:progress', handler)
    },
  },

  plan: {
    build: (libraryId: string, options: PlanOptionsDto): Promise<PlanDto> =>
      ipcRenderer.invoke('plan:build', libraryId, options),
    apply: (
      libraryId: string,
      options: PlanOptionsDto,
      selectedIds: string[] | null,
    ): Promise<ApplyResultDto> => ipcRenderer.invoke('plan:apply', libraryId, options, selectedIds),
  },

  journals: {
    list: (libraryId: string): Promise<JournalSummary[]> =>
      ipcRenderer.invoke('journals:list', libraryId),
    undo: (journalPath: string): Promise<UndoResultDto> =>
      ipcRenderer.invoke('journals:undo', journalPath),
  },

  dats: {
    chooseLocal: (): Promise<string[]> => ipcRenderer.invoke('dats:chooseLocal'),
    status: (): Promise<{ systemId: string; updatedAt: string }[]> =>
      ipcRenderer.invoke('dats:status'),
  },
}

export type RomOrgApi = typeof api

contextBridge.exposeInMainWorld('romorg', api)
