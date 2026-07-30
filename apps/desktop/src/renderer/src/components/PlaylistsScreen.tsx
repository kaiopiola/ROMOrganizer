import { useCallback, useEffect, useState } from 'react'
import type { PlaylistStatusDto } from '../../../main/ipc-types.ts'
import { locale, t } from '../i18n.ts'
import { SystemIcon } from './SystemIcon.tsx'

interface Props {
  icons: Record<string, string | null>
  onError: (message: string) => void
}

/**
 * Gestão das playlists, por plataforma.
 *
 * Fica numa tela própria porque é uma operação sobre a coleção inteira, não sobre a pasta que
 * está aberta: quem mantém oito consoles quer ver de uma vez o que está gerado e o que não.
 */
export function PlaylistsScreen({ icons, onError }: Props) {
  const [status, setStatus] = useState<PlaylistStatusDto[] | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await window.romorg.playlists.status())
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [onError])

  // Carrega sozinho: o estado das playlists é o conteúdo da tela, não algo a pedir.
  useEffect(() => {
    void refresh()
  }, [refresh])

  async function generate(entry: PlaylistStatusDto): Promise<void> {
    setWorking(entry.libraryId)
    try {
      // Regerar substitui: é exatamente o que o botão promete quando a playlist já existe.
      await window.romorg.playlists.write(entry.libraryId, { overwrite: true })
      await refresh()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setWorking(null)
    }
  }

  function formatDate(value: string | null): string {
    if (value === null) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-sm font-medium">{t.playlistsTitle}</h2>
        <p className="text-xs text-neutral-500">{t.playlistsScreenHint}</p>
      </header>

      {status === null ? (
        <p className="px-6 py-8 text-sm text-neutral-500">{t.playlistsChecking}</p>
      ) : status.length === 0 ? (
        <p className="px-6 py-8 text-sm text-neutral-500">{t.librariesEmpty}</p>
      ) : (
        <ul>
          {status.map((entry) => {
            // Sem identificação carregada não há o que gerar — gerar vazio apagaria uma
            // playlist boa e devolveria uma lista sem nada.
            const ready = entry.identified > 0 && entry.games > 0
            const busy = working === entry.libraryId

            return (
              <li
                key={entry.libraryId}
                className="flex items-center gap-4 border-b border-neutral-900 px-6 py-4 last:border-b-0"
              >
                <SystemIcon source={icons[entry.systemId] ?? null} className="size-9 shrink-0" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.systemName}</p>
                  <p className="truncate text-xs text-neutral-500" title={entry.directory}>
                    {entry.directory}
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    {ready ? (
                      <>
                        {t.playlistsItems(entry.games)}
                        {entry.discGroups.length > 0 && (
                          <> · {t.playlistsGroups(entry.discGroups.length)}</>
                        )}
                        {entry.lplExists && entry.lplUpdatedAt !== null && (
                          <> · {t.playlistsGeneratedAt(formatDate(entry.lplUpdatedAt))}</>
                        )}
                      </>
                    ) : (
                      <span className="text-amber-500">{t.playlistsNeedsScan}</span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void generate(entry)}
                  disabled={!ready || busy}
                  className="shrink-0 rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40"
                >
                  {busy
                    ? t.playlistsGenerating
                    : entry.lplExists
                      ? t.playlistsRegenerate
                      : t.playlistsGenerate}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
