import { useEffect, useMemo, useRef, useState } from 'react'
import type { SystemRulePack } from '@romorg/core/browser'
import { t } from '../i18n.ts'

interface Props {
  systems: SystemRulePack[]
  onPick: (systemId: string) => void
  onClose: () => void
}

/**
 * Escolha de console em diálogo próprio.
 *
 * Um `<select>` nativo com dezenas de consoles obriga a rolar uma lista sem contexto. Aqui os
 * sistemas vêm agrupados por fabricante e com busca — que é como as pessoas de fato procuram
 * ("mega drive", "snes"), e o que permite a lista crescer sem piorar.
 */
export function SystemPickerModal({ systems, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return systems

    // Busca também por id e extensão: quem digita "smc" ou "snes" quer o mesmo console.
    return systems.filter((system) =>
      [system.name, system.id, system.manufacturer, ...system.extensions]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [systems, query])

  const grouped = useMemo(() => {
    const groups = new Map<string, SystemRulePack[]>()
    for (const system of filtered) {
      const bucket = groups.get(system.manufacturer)
      if (bucket) bucket.push(system)
      else groups.set(system.manufacturer, [system])
    }
    return [...groups].sort(([left], [right]) => left.localeCompare(right))
  }, [filtered])

  // Índice contínuo sobre a lista achatada, para as setas atravessarem os grupos.
  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((current) => Math.min(current + 1, flat.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((current) => Math.max(current - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      const system = flat[highlighted]
      if (system !== undefined) onPick(system.id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-24"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.chooseSystem}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex max-h-[60vh] w-[min(560px,90vw)] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
      >
        <div className="border-b border-neutral-800 p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchSystem}
            className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">{t.noSystemFound}</p>
          )}

          {grouped.map(([manufacturer, items]) => (
            <div key={manufacturer} className="mb-2">
              <h3 className="px-3 py-1 text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {manufacturer}
              </h3>
              {items.map((system) => {
                const isHighlighted = flat.indexOf(system) === highlighted
                return (
                  <button
                    key={system.id}
                    type="button"
                    onMouseEnter={() => setHighlighted(flat.indexOf(system))}
                    onClick={() => onPick(system.id)}
                    className={`flex w-full items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left ${
                      isHighlighted ? 'bg-emerald-600/20 ring-1 ring-emerald-600' : ''
                    }`}
                  >
                    <span className="text-sm">{system.name}</span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {system.extensions.map((extension) => `.${extension}`).join(' ')}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
