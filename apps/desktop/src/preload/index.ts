import { contextBridge, ipcRenderer } from 'electron'
import type { SystemRulePack } from '@romorg/core'

/**
 * Única ponte entre renderer e disco. O renderer nunca acessa o filesystem direto —
 * toda operação destrutiva precisa passar pelo main, onde ficam dry-run e journal.
 */
const api = {
  listSystems: (): Promise<SystemRulePack[]> => ipcRenderer.invoke('systems:list'),
}

export type RomOrgApi = typeof api

contextBridge.exposeInMainWorld('romorg', api)
