import { contextBridge, ipcRenderer } from 'electron'
import type { SystemRulePack } from '@romorg/core'
import type { Library, LibraryChanges, Preferences } from '../main/libraries.ts'
import type { UpdateStatus } from '../main/updater.ts'
import type { ChangelogEntry } from '../main/changelog.ts'
import type {
  ApplyProgress,
  ApplyResultDto,
  AuditOptionsDto,
  AuditReportDto,
  JournalSummary,
  PlanOptionsDto,
  PlanResultDto,
  PlaylistStatusDto,
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

  /** Idioma escolhido, resolvido pelo main antes da janela abrir. */
  language:
    process.argv.find((argument) => argument.startsWith('--romorg-language='))?.split('=')[1] ??
    'auto',

  listSystems: (): Promise<SystemRulePack[]> => ipcRenderer.invoke('systems:list'),

  app: {
    info: (): Promise<{
      version: string
      electron: string
      node: string
      platform: string
      arch: string
      userData: string
      systems: number
      language: string
    }> => ipcRenderer.invoke('app:info'),
    changelog: (): Promise<ChangelogEntry[]> => ipcRenderer.invoke('app:changelog'),
    openPath: (path: string): Promise<void> => ipcRenderer.invoke('app:openPath', path),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
    relaunch: (): Promise<void> => ipcRenderer.invoke('app:relaunch'),
  },

  updates: {
    check: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updates:install'),
    openRelease: (): Promise<void> => ipcRenderer.invoke('updates:openRelease'),
  },

  preferences: {
    get: (): Promise<Preferences> => ipcRenderer.invoke('preferences:get'),
    set: (changes: Partial<Preferences>): Promise<Preferences> =>
      ipcRenderer.invoke('preferences:set', changes),
  },

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
    start: (libraryId: string): Promise<ScanSummaryDto> =>
      ipcRenderer.invoke('scan:start', libraryId),
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

  audit: {
    run: (libraryId: string, options: AuditOptionsDto): Promise<AuditReportDto> =>
      ipcRenderer.invoke('audit:run', libraryId, options),
    export: (
      libraryId: string,
      report: AuditReportDto,
      format: 'csv' | 'markdown',
    ): Promise<string | null> => ipcRenderer.invoke('audit:export', libraryId, report, format),
  },

  playlists: {
    /** Estado das playlists de todas as bibliotecas. */
    status: (): Promise<PlaylistStatusDto[]> => ipcRenderer.invoke('playlists:status'),
    write: (
      libraryId: string,
      options: { overwrite: boolean },
    ): Promise<{ written: string[]; skipped: string[] }> =>
      ipcRenderer.invoke('playlists:write', libraryId, options),
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
