import { app, shell } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const REPOSITORY = 'kaiopiola/ROMOrganizer'
const RELEASES_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const RELEASES_PAGE = `https://github.com/${REPOSITORY}/releases/latest`

export interface UpdateStatus {
  currentVersion: string
  /** Versão disponível, ou `null` quando já está atualizado. */
  availableVersion: string | null
  /**
   * O app consegue instalar a atualização sozinho.
   *
   * Falso no macOS sem assinatura — ver a nota em `canSelfUpdate`. Nesse caso, resta abrir a
   * página do release, e a interface precisa dizer isso em vez de oferecer um botão que falha.
   */
  canInstall: boolean
  releaseUrl: string
  /** Motivo de não poder atualizar sozinho, quando é o caso. */
  reason: string | null
}

/**
 * O auto-update do Electron exige assinatura de código no macOS.
 *
 * O Squirrel.Mac recusa aplicar um update sobre um app não assinado — e este projeto distribui
 * sem certificado. Em vez de tentar e falhar com uma mensagem incompreensível, o macOS detecta
 * a versão nova pela API do GitHub e leva o usuário ao release.
 */
function canSelfUpdate(): { ok: boolean; reason: string | null } {
  if (!app.isPackaged) {
    return { ok: false, reason: 'development' }
  }
  if (process.platform === 'darwin') {
    return { ok: false, reason: 'macos-unsigned' }
  }
  return { ok: true, reason: null }
}

/** Compara versões semânticas simples (`1.2.3`), sem depender de uma biblioteca para isso. */
function isNewer(candidate: string, current: string): boolean {
  const parse = (value: string): number[] =>
    value
      .replace(/^v/, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)

  const [a, b] = [parse(candidate), parse(current)]
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (left !== right) return left > right
  }
  return false
}

/** Consulta a última release publicada. Usado onde o auto-update não se aplica. */
async function latestPublishedVersion(): Promise<string | null> {
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return null

    const release = (await response.json()) as { tag_name?: string; draft?: boolean }
    if (release.draft === true || typeof release.tag_name !== 'string') return null

    return release.tag_name.replace(/^v/, '')
  } catch {
    // Sem rede: não saber se há atualização não é erro que valha interromper o app.
    return null
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const currentVersion = app.getVersion()
  const base: UpdateStatus = {
    currentVersion,
    availableVersion: null,
    canInstall: false,
    releaseUrl: RELEASES_PAGE,
    reason: null,
  }

  const capability = canSelfUpdate()

  if (!capability.ok) {
    const latest = await latestPublishedVersion()
    return {
      ...base,
      availableVersion: latest !== null && isNewer(latest, currentVersion) ? latest : null,
      reason: capability.reason,
    }
  }

  try {
    autoUpdater.autoDownload = false
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo.version ?? null

    return {
      ...base,
      availableVersion: version !== null && isNewer(version, currentVersion) ? version : null,
      canInstall: version !== null && isNewer(version, currentVersion),
    }
  } catch (cause) {
    return { ...base, reason: cause instanceof Error ? cause.message : String(cause) }
  }
}

/**
 * Baixa e instala, reiniciando o app.
 *
 * Só faz sentido onde `canInstall` é verdadeiro; nos demais casos a interface abre o release.
 */
export async function downloadAndInstall(): Promise<void> {
  await autoUpdater.downloadUpdate()
  autoUpdater.quitAndInstall()
}

export async function openReleasePage(): Promise<void> {
  await shell.openExternal(RELEASES_PAGE)
}
