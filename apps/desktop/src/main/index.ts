import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { loadRulePacksFrom, SystemRegistry } from '@romorg/core'
import type { SystemRulePack } from '@romorg/core'

const IS_DEV = !app.isPackaged

/**
 * Em desenvolvimento os rule packs vêm de `data/systems` na raiz do repo; empacotado,
 * de `resources/` (ver `extraResources` no electron-builder.yml). Ficam fora do bundle
 * de propósito: assim uma correção de regra não exige uma release nova.
 */
function rulePacksDirectory(): string {
  return IS_DEV
    ? fileURLToPath(new URL('../../../../data/systems', import.meta.url))
    : join(process.resourcesPath, 'systems')
}

let registry: SystemRegistry | null = null

async function getRegistry(): Promise<SystemRegistry> {
  registry ??= new SystemRegistry(await loadRulePacksFrom(rulePacksDirectory()))
  return registry
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.on('ready-to-show', () => window.show())

  // Nada de navegação para fora dentro da janela do app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (IS_DEV && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('systems:list', async (): Promise<SystemRulePack[]> => {
  return (await getRegistry()).all()
})

void app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
