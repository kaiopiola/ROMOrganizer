import { useMemo, useState } from 'react'
import type { SkipReason } from '@romorg/core/browser'
import type { PlanDto } from '../../../main/ipc-types.ts'
import { t } from '../i18n.ts'

const SKIP_LABEL: Record<SkipReason, string> = {
  'already-named': t.skipAlreadyNamed,
  'no-proposal': t.skipNoProposal,
  ambiguous: t.skipAmbiguous,
  collision: t.skipCollision,
  'duplicate-target': t.skipDuplicateTarget,
}

function basename(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index === -1 ? path : path.slice(index + 1)
}

/** Mostra a subpasta quando o destino tem uma, para o movimento ficar visível. */
function relativeTarget(from: string, to: string): string {
  const fromDir = from.slice(0, from.lastIndexOf('/'))
  const toDir = to.slice(0, to.lastIndexOf('/'))
  return fromDir === toDir ? basename(to) : `${basename(toDir)}/${basename(to)}`
}

interface Props {
  plan: PlanDto
  busy: boolean
  includeFilenameMatches: boolean
  allowAmbiguous: boolean
  quarantineDirectory: string
  /** `null` significa "todas as operações do plano". */
  selectedIds: Set<string> | null
  onToggleFilenameMatches: (value: boolean) => void
  onToggleAmbiguous: (value: boolean) => void
  onQuarantineChange: (value: string) => void
  onSelectionChange: (value: Set<string> | null) => void
  onApply: () => void
}

/**
 * O plano — a tela de dry-run.
 *
 * Mostra exatamente o que a execução vai fazer, por que cada arquivo ficou de fora, e permite
 * escolher linha a linha. O botão de aplicar é o único caminho para o disco.
 */
export function PlanPanel({
  plan,
  busy,
  includeFilenameMatches,
  allowAmbiguous,
  quarantineDirectory,
  selectedIds,
  onToggleFilenameMatches,
  onToggleAmbiguous,
  onQuarantineChange,
  onSelectionChange,
  onApply,
}: Props) {
  const [quarantineDraft, setQuarantineDraft] = useState(quarantineDirectory)

  const skipCounts = useMemo(() => {
    const counts = new Map<SkipReason, number>()
    for (const entry of plan.skipped) {
      counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1)
    }
    return [...counts].sort((left, right) => right[1] - left[1])
  }, [plan.skipped])

  const isSelected = (id: string): boolean => selectedIds === null || selectedIds.has(id)
  const selectedCount = selectedIds === null ? plan.operations.length : selectedIds.size

  function toggle(id: string): void {
    // A seleção só vira um conjunto explícito quando o usuário mexe nela; até lá, "todos".
    const current = selectedIds ?? new Set(plan.operations.map((operation) => operation.id))
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  const allSelected = selectedIds === null || selectedIds.size === plan.operations.length

  return (
    <section className="rounded-lg border border-neutral-800">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">
            {t.planTitle} · {t.toRename(plan.operations.length)}
          </h2>
          <p className="text-xs text-neutral-500">{t.dryRunNotice}</p>
        </div>

        <button
          type="button"
          onClick={onApply}
          disabled={busy || selectedCount === 0}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
        >
          {busy ? t.applying : t.applySelected(selectedCount)}
        </button>
      </header>

      <div className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={includeFilenameMatches}
            onChange={(event) => onToggleFilenameMatches(event.target.checked)}
          />
          {t.includeFilenameMatches}
        </label>
        {includeFilenameMatches && (
          <p className="pl-6 text-xs text-amber-400">{t.includeFilenameMatchesHint}</p>
        )}

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={allowAmbiguous}
            onChange={(event) => onToggleAmbiguous(event.target.checked)}
          />
          {t.allowAmbiguous}
        </label>

        <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={quarantineDirectory !== ''}
            onChange={(event) =>
              onQuarantineChange(event.target.checked ? quarantineDraft || '_unidentified' : '')
            }
          />
          {t.quarantine}
          {quarantineDirectory !== '' && (
            <input
              value={quarantineDraft}
              onChange={(event) => setQuarantineDraft(event.target.value)}
              onBlur={() => onQuarantineChange(quarantineDraft)}
              placeholder="_unidentified"
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 font-mono text-xs"
            />
          )}
        </label>
        {quarantineDirectory !== '' && (
          <p className="pl-6 text-xs text-neutral-500">{t.quarantineHint}</p>
        )}
      </div>

      {plan.operations.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{t.planEmpty}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onSelectionChange(allSelected ? new Set<string>() : null)}
            />
            <span className="text-xs text-neutral-500">
              {t.selectedOf(selectedCount, plan.operations.length)}
            </span>
          </div>

          <ul className="max-h-72 overflow-y-auto px-4 py-2 text-sm">
            {plan.operations.map((operation) => (
              <li key={operation.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={isSelected(operation.id)}
                  onChange={() => toggle(operation.id)}
                  className="shrink-0"
                />
                <span className="min-w-0 truncate text-neutral-400" title={operation.from}>
                  {basename(operation.from)}
                </span>
                <span className="shrink-0 text-neutral-600">→</span>
                <span className="min-w-0 truncate" title={operation.to}>
                  {relativeTarget(operation.from, operation.to)}
                </span>
                {operation.quarantine && (
                  <span
                    title={t.quarantineHint}
                    className="shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400"
                  >
                    {t.quarantineTag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {skipCounts.length > 0 && (
        <div className="border-t border-neutral-800 px-4 py-3">
          <h3 className="mb-1 text-xs font-medium tracking-widest text-neutral-500 uppercase">
            {t.skippedTitle}
          </h3>
          <ul className="text-sm text-neutral-400">
            {skipCounts.map(([reason, count]) => (
              <li key={reason} className="flex justify-between py-0.5">
                <span>{SKIP_LABEL[reason]}</span>
                <span className="tabular-nums text-neutral-500">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
