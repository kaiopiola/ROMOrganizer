import { useState } from 'react'
import type { SystemRulePack } from '@romorg/core/browser'
import type { Library } from '../../../main/libraries.ts'
import { t } from '../i18n.ts'
import { SystemPickerModal } from './SystemPickerModal.tsx'

interface Props {
  systems: SystemRulePack[]
  libraries: Library[]
  activeId: string | null
  onSelect: (id: string) => void
  onChanged: () => Promise<void>
}

export function LibrarySidebar({ systems, libraries, activeId, onSelect, onChanged }: Props) {
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

          return (
            <li key={library.id}>
              <button
                type="button"
                onClick={() => onSelect(library.id)}
                className={`w-full rounded-md px-3 py-2 text-left ${
                  isActive ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'
                }`}
              >
                <span className="block truncate text-sm font-medium">
                  {system?.name ?? library.systemId}
                </span>
                <span className="block truncate text-xs text-neutral-500" dir="rtl">
                  {library.directory}
                </span>
              </button>

              {isActive && (
                <div className="flex flex-col gap-1 px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={library.recursive}
                      onChange={async (event) => {
                        await window.romorg.libraries.update(library.id, {
                          recursive: event.target.checked,
                        })
                        await onChanged()
                      }}
                    />
                    {t.recursive}
                  </label>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-neutral-200"
                      onClick={() => void window.romorg.libraries.reveal(library.id)}
                    >
                      {t.revealLibrary}
                    </button>
                    <button
                      type="button"
                      className="text-neutral-500 hover:text-red-400"
                      onClick={async () => {
                        await window.romorg.libraries.remove(library.id)
                        await onChanged()
                      }}
                    >
                      {t.removeLibrary}
                    </button>
                  </div>
                </div>
              )}
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
