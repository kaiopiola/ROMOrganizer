import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../main/updater.ts'
import { t } from '../i18n.ts'

/**
 * Aviso de versão nova.
 *
 * Aparece só quando há atualização — um app de organizar arquivos não deve gastar espaço
 * permanente dizendo que está em dia. O botão muda conforme o app consegue ou não se atualizar
 * sozinho: prometer instalação onde ela falharia é pior que mandar o usuário à página.
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Silencioso de propósito: sem rede, ou em desenvolvimento, simplesmente não há aviso.
    void (async () => {
      const preferences = await window.romorg.preferences.get()
      if (!preferences.checkUpdatesOnStart) return
      setStatus(await window.romorg.updates.check())
    })().catch(() => undefined)
  }, [])

  if (status === null || status.availableVersion === null || dismissed) return null

  return (
    <div className="flex items-center gap-3 border-b border-emerald-900 bg-emerald-950/40 px-8 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-emerald-200">
        {t.updateAvailable(status.availableVersion)}
        {!status.canInstall && status.reason === 'macos-unsigned' && (
          <span className="ml-2 text-xs text-emerald-400/70">{t.updateManualMac}</span>
        )}
      </span>

      {status.canInstall ? (
        <button
          type="button"
          disabled={installing}
          onClick={() => {
            setInstalling(true)
            void window.romorg.updates.install().catch(() => setInstalling(false))
          }}
          className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {installing ? t.updateInstalling : t.updateInstall}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void window.romorg.updates.openRelease()}
          className="shrink-0 rounded-md border border-emerald-800 px-3 py-1 text-xs hover:bg-emerald-900/40"
        >
          {t.updateOpenRelease}
        </button>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-xs text-emerald-400/60 hover:text-emerald-200"
      >
        {t.updateDismiss}
      </button>
    </div>
  )
}
