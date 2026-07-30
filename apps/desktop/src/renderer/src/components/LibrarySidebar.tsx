import { useState } from 'react'
import type { SystemRulePack } from '@romorg/core/browser'
import type { Library } from '../../../main/libraries.ts'
import type { Job } from '../useJobQueue.ts'
import { t } from '../i18n.ts'
import { SystemPickerModal } from './SystemPickerModal.tsx'
import { SystemIcon } from './SystemIcon.tsx'
import type { View } from '../views.ts'

interface Props {
  systems: SystemRulePack[]
  libraries: Library[]
  icons: Record<string, string | null>
  activeId: string | null
  /** Tela aberta: a lista de bibliotecas some do destaque quando é outra. */
  view: View
  onViewChange: (view: View) => void
  /** Quantos trabalhos estão rodando ou na fila, para o item de navegação mostrar. */
  activeJobs: number
  /** Trabalho em andamento ou na fila para cada biblioteca. */
  jobFor: (libraryId: string) => Job | undefined
  onSelect: (id: string) => void
  onChanged: () => Promise<void>
}

export function LibrarySidebar({
  systems,
  libraries,
  icons,
  activeId,
  view,
  onViewChange,
  activeJobs,
  jobFor,
  onSelect,
  onChanged,
}: Props) {
  const [adding, setAdding] = useState(false)

  async function addLibrary(systemId: string): Promise<void> {
    const library = await window.romorg.libraries.choose(systemId)
    setAdding(false)
    if (library === null) return
    await onChanged()
    onSelect(library.id)
  }

  // No macOS a janela usa `hiddenInset`: os botões de semáforo flutuam sobre o conteúdo, no
  // canto superior esquerdo — exatamente onde fica esta barra lateral.
  const isMac = window.romorg.platform === 'darwin'

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/40">
      <div
        className={isMac ? 'px-4 pt-11 pb-4' : 'px-4 py-5'}
        // A faixa livre acima do título serve para arrastar a janela.
        style={isMac ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
      >
        <h2 className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
          {t.librariesTitle}
        </h2>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2">
        {libraries.map((library) => {
          const system = systems.find((candidate) => candidate.id === library.systemId)
          const isActive = library.id === activeId
          const job = jobFor(library.id)

          return (
            <li key={library.id}>
              <button
                type="button"
                onClick={() => {
                  onViewChange('library')
                  onSelect(library.id)
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
                  isActive && view === 'library' ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'
                }`}
              >
                <SystemIcon source={icons[library.systemId] ?? null} className="size-7 shrink-0" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {system?.name ?? library.systemId}
                  </span>
                  <span className="block truncate text-xs text-neutral-500" dir="rtl">
                    {library.directory}
                  </span>

                  {job !== undefined && (
                    <span className="mt-1 block">
                      <span className="block h-0.5 w-full overflow-hidden rounded bg-neutral-700">
                        <span
                          className={`block h-full transition-[width] ${
                            job.status === 'pending' ? 'bg-neutral-500' : 'bg-emerald-500'
                          }`}
                          style={{
                            width:
                              job.status === 'pending'
                                ? '100%'
                                : `${(job.done / Math.max(job.total, 1)) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="mt-0.5 block text-[0.65rem] text-neutral-500">
                        {job.status === 'pending'
                          ? t.jobPending
                          : `${job.kind === 'scan' ? t.jobScan : t.jobApply} ${job.done}/${job.total}`}
                      </span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}

        {libraries.length === 0 && (
          <li className="px-3 py-2 text-sm text-neutral-500">{t.librariesEmpty}</li>
        )}
      </ul>

      <div className="border-t border-neutral-800 p-3">
        <button
          type="button"
          onClick={() => onViewChange('playlists')}
          className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${
            view === 'playlists' ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'
          }`}
        >
          {t.playlistsTitle}
        </button>

        <button
          type="button"
          onClick={() => onViewChange('queue')}
          className={`mb-2 flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
            view === 'queue' ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'
          }`}
        >
          {t.queueTitle}
          {activeJobs > 0 && (
            <span className="rounded-full bg-emerald-600 px-1.5 text-xs text-white">
              {activeJobs}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onViewChange('settings')}
          className={`mb-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${
            view === 'settings' ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'
          }`}
        >
          {t.settingsTitle}
        </button>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
        >
          {t.addLibrary}
        </button>
      </div>

      {adding && (
        <SystemPickerModal
          systems={systems}
          onPick={(systemId) => void addLibrary(systemId)}
          onClose={() => setAdding(false)}
        />
      )}
    </aside>
  )
}
