import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { loadRulePacksFrom, SystemRegistry } from '@romorg/core'
import { DatCache } from './dat-cache.ts'
import { IconCache } from './icon-cache.ts'
import { LibraryStore } from './libraries.ts'
import { registerIpc } from './ipc.ts'

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

/**
 * Ícone da janela, só no Linux — macOS e Windows já o tiram do bundle (`.app`/`.exe`). Sem
 * isto, a janela e a barra de tarefas do Linux ficam com o ícone padrão do Electron.
 */
function windowIcon(): string | undefined {
  if (process.platform !== 'linux') return undefined
  return IS_DEV
    ? fileURLToPath(new URL('../../build/icon.png', import.meta.url))
    : join(process.resourcesPath, 'icon.png')
}

/**
 * O idioma precisa estar disponível no carregamento do renderer, antes do primeiro render —
 * buscá-lo por IPC deixaria a interface aparecer no idioma errado e trocar depois. Por isso
 * ele viaja como argumento da janela.
 */
function createWindow(language: string): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    icon: windowIcon(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      additionalArguments: [`--romorg-language=${language}`],
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

void app.whenReady().then(async () => {
  const registry = new SystemRegistry(await loadRulePacksFrom(rulePacksDirectory()))
  const libraries = new LibraryStore(join(app.getPath('userData'), 'libraries.json'))
  const datCache = new DatCache(join(app.getPath('userData'), 'dat-cache'))
  const iconCache = new IconCache(join(app.getPath('userData'), 'icons'))

  registerIpc(registry, libraries, datCache, iconCache)

  const { language } = await libraries.preferences()
  createWindow(language)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void reopen()
  })

  async function reopen(): Promise<void> {
    const preferences = await libraries.preferences()
    createWindow(preferences.language)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
