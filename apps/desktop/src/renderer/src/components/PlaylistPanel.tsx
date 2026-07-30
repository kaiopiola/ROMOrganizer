import { useState } from 'react'
import type { PlaylistPlanDto } from '../../../main/ipc-types.ts'
import { t } from '../i18n.ts'

interface Props {
  libraryId: string
  onNotice: (message: string) => void
  onError: (message: string) => void
}

/**
 * Geração de playlists.
 *
 * Mostra o que seria criado antes de criar — mesmo critério do rename. O risco aqui é menor,
 * já que criar arquivo não apaga nada, mas sobrescrever uma playlist editada à mão seria perda
 * igual, então o que já existe aparece marcado e só é substituído com permissão explícita.
 */
export function PlaylistPanel({ libraryId, onNotice, onError }: Props) {
  const [preview, setPreview] = useState<PlaylistPlanDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [overwrite, setOverwrite] = useState(false)

  async function refresh(): Promise<void> {
    setBusy(true)
    try {
      setPreview(await window.romorg.playlists.preview(libraryId))
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function write(kinds: { m3u: boolean; lpl: boolean }): Promise<void> {
    setBusy(true)
    try {
      const result = await window.romorg.playlists.write(libraryId, { ...kinds, overwrite })
      onNotice(t.playlistsWritten(result.written.length, result.skipped.length))
      await refresh()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const existingCount =
    preview === null
      ? 0
      : preview.m3u.filter((entry) => entry.exists).length + (preview.lpl.exists ? 1 : 0)

  return (
    <section className="rounded-lg border border-neutral-800">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">{t.playlistsTitle}</h2>
          <p className="text-xs text-neutral-500">{t.playlistsHint}</p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40"
        >
          {busy ? t.playlistsChecking : t.playlistsCheck}
        </button>
      </header>

      {preview === null ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{t.playlistsEmpty}</p>
      ) : (
        <>
          <div className="border-b border-neutral-800 px-4 py-3">
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="min-w-0 truncate text-sm">
                {preview.lpl.fileName}
                <span className="ml-2 text-xs text-neutral-500">
                  {t.playlistsItems(preview.lpl.items)}
                </span>
                {preview.lpl.exists && (
                  <span className="ml-2 text-xs text-amber-400">{t.playlistsExists}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => void write({ m3u: false, lpl: true })}
                disabled={busy || preview.lpl.items === 0}
                className="shrink-0 rounded-md border border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-800 disabled:opacity-40"
              >
                {t.playlistsGenerate}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              <span className="min-w-0 truncate text-sm">
                {t.playlistsM3u}
                <span className="ml-2 text-xs text-neutral-500">
                  {t.playlistsGroups(preview.m3u.length)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void write({ m3u: true, lpl: false })}
                disabled={busy || preview.m3u.length === 0}
                className="shrink-0 rounded-md border border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-800 disabled:opacity-40"
              >
                {t.playlistsGenerate}
              </button>
            </div>
          </div>

          {preview.m3u.length > 0 && (
            <ul className="max-h-40 overflow-y-auto px-4 py-2 text-xs text-neutral-400">
              {preview.m3u.map((entry) => (
                <li key={entry.fileName} className="truncate py-0.5">
                  {entry.fileName}
                  <span className="ml-2 text-neutral-600">
                    {t.playlistsDiscs(entry.discs.length)}
                  </span>
                  {entry.exists && <span className="ml-2 text-amber-400">{t.playlistsExists}</span>}
                </li>
              ))}
            </ul>
          )}

          {existingCount > 0 && (
            <label className="flex items-center gap-2 border-t border-neutral-800 px-4 py-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(event) => setOverwrite(event.target.checked)}
              />
              {t.playlistsOverwrite(existingCount)}
            </label>
          )}
        </>
      )}
    </section>
  )
}
