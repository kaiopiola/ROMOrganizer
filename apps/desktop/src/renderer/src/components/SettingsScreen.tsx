import { useEffect, useState } from 'react'
import type { Preferences } from '../../../main/libraries.ts'
import type { ChangelogEntry } from '../../../main/changelog.ts'
import type { UpdateStatus } from '../../../main/updater.ts'
import { t } from '../i18n.ts'
import { Markdown } from './Markdown.tsx'

type Tab = 'general' | 'updates' | 'changelog' | 'about'

interface AppInfo {
  version: string
  electron: string
  node: string
  platform: string
  arch: string
  userData: string
  systems: number
  language: string
}

const REPOSITORY = 'https://github.com/kaiopiola/ROMOrganizer'

interface Props {
  onError: (message: string) => void
}

/**
 * Configurações do app.
 *
 * As abas separam o que se ajusta do que se consulta: preferências de um lado; versão, notas e
 * atualização do outro. Só o que vale para o app inteiro mora aqui — o que é de uma coleção
 * fica na tela dela.
 */
export function SettingsScreen({ onError }: Props) {
  const [tab, setTab] = useState<Tab>('general')
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [changelog, setChangelog] = useState<ChangelogEntry[] | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void window.romorg.preferences.get().then(setPreferences)
    void window.romorg.app.info().then(setInfo)
  }, [])

  useEffect(() => {
    if (tab === 'changelog' && changelog === null) {
      void window.romorg.app
        .changelog()
        .then(setChangelog)
        .catch(() => setChangelog([]))
    }
  }, [tab, changelog])

  async function save(changes: Partial<Preferences>): Promise<void> {
    try {
      setPreferences(await window.romorg.preferences.set(changes))
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function changeLanguage(language: Preferences['language']): Promise<void> {
    await save({ language })
    // As strings são resolvidas no carregamento do renderer; sem reiniciar, metade da tela
    // ficaria no idioma antigo.
    await window.romorg.app.relaunch()
  }

  async function check(): Promise<void> {
    setChecking(true)
    try {
      setUpdate(await window.romorg.updates.check())
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setChecking(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: t.settingsGeneral },
    { id: 'updates', label: t.settingsUpdates },
    { id: 'changelog', label: t.settingsChangelog },
    { id: 'about', label: t.settingsAbout },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex shrink-0 gap-1 border-b border-neutral-800 px-6">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === entry.id
                ? 'border-emerald-500 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {tab === 'general' && preferences !== null && (
          <div className="max-w-xl space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-medium">{t.settingsLanguage}</h3>
              <div className="flex gap-2">
                {(['auto', 'pt-BR', 'en'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void changeLanguage(option)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      preferences.language === option
                        ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                        : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {option === 'auto'
                      ? t.settingsLanguageAuto
                      : option === 'pt-BR'
                        ? 'Português'
                        : 'English'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">{t.settingsLanguageHint}</p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium">{t.settingsUpdates}</h3>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={preferences.checkUpdatesOnStart}
                  onChange={(event) => void save({ checkUpdatesOnStart: event.target.checked })}
                />
                {t.settingsCheckOnStart}
              </label>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium">{t.settingsData}</h3>
              <p className="mb-2 text-xs text-neutral-500">{t.settingsDataHint}</p>
              <button
                type="button"
                onClick={() => void window.romorg.app.openPath(info?.userData ?? '')}
                disabled={info === null}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-40"
              >
                {t.settingsOpenDataFolder}
              </button>
            </section>
          </div>
        )}

        {tab === 'updates' && (
          <div className="max-w-xl space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void check()}
                disabled={checking}
                className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40"
              >
                {checking ? t.settingsChecking : t.settingsCheckNow}
              </button>
              <span className="text-sm text-neutral-500">
                {t.settingsCurrentVersion(info?.version ?? '—')}
              </span>
            </div>

            {update !== null && (
              <div className="rounded-lg border border-neutral-800 p-4 text-sm">
                {update.availableVersion === null ? (
                  <p className="text-neutral-400">{t.settingsUpToDate}</p>
                ) : (
                  <>
                    <p className="mb-2 text-emerald-300">
                      {t.updateAvailable(update.availableVersion)}
                    </p>
                    {update.canInstall ? (
                      <button
                        type="button"
                        onClick={() => void window.romorg.updates.install()}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500"
                      >
                        {t.updateInstall}
                      </button>
                    ) : (
                      <>
                        <p className="mb-2 text-xs text-neutral-500">
                          {update.reason === 'macos-unsigned'
                            ? t.settingsMacUnsigned
                            : update.reason === 'development'
                              ? t.settingsDevBuild
                              : update.reason}
                        </p>
                        <button
                          type="button"
                          onClick={() => void window.romorg.updates.openRelease()}
                          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                        >
                          {t.updateOpenRelease}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'changelog' && (
          <div className="max-w-2xl">
            {changelog === null ? (
              <p className="text-sm text-neutral-500">{t.settingsChecking}</p>
            ) : changelog.length === 0 ? (
              <p className="text-sm text-neutral-500">{t.settingsNoChangelog}</p>
            ) : (
              <div className="space-y-8">
                {changelog.map((entry) => (
                  <article key={entry.version}>
                    <Markdown source={entry.body} />
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'about' && info !== null && (
          <div className="max-w-xl space-y-5 text-sm">
            <div>
              <h3 className="text-base font-semibold">{t.appName}</h3>
              <p className="text-neutral-400">{t.tagline}</p>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-neutral-400">
              <dt>{t.settingsVersion}</dt>
              <dd className="font-mono text-neutral-300">{info.version}</dd>
              <dt>Electron</dt>
              <dd className="font-mono text-neutral-300">{info.electron}</dd>
              <dt>Node</dt>
              <dd className="font-mono text-neutral-300">{info.node}</dd>
              <dt>{t.settingsPlatform}</dt>
              <dd className="font-mono text-neutral-300">
                {info.platform} {info.arch}
              </dd>
              <dt>{t.settingsSystemsLoaded}</dt>
              <dd className="font-mono text-neutral-300">{info.systems}</dd>
            </dl>

            <p className="text-neutral-400">{t.settingsLegal}</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void window.romorg.app.openExternal(REPOSITORY)}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
              >
                {t.settingsRepository}
              </button>
              <button
                type="button"
                onClick={() =>
                  void window.romorg.app.openExternal(`${REPOSITORY}/blob/main/LICENSE`)
                }
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
              >
                GPL-3.0
              </button>
            </div>

            <p className="text-xs text-neutral-500">{t.settingsCredits}</p>
          </div>
        )}
      </div>
    </div>
  )
}
