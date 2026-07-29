import { useMemo } from 'react'
import type { SkipReason } from '@romorg/core'
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

interface Props {
  plan: PlanDto
  busy: boolean
  includeFilenameMatches: boolean
  allowAmbiguous: boolean
  onToggleFilenameMatches: (value: boolean) => void
  onToggleAmbiguous: (value: boolean) => void
  onApply: () => void
}

/**
 * O plano — a tela de dry-run.
 *
 * Mostra exatamente o que a execução vai fazer, e por que cada arquivo ficou de fora. O botão
 * de aplicar é o único caminho para o disco, e nada acontece antes de ele ser clicado.
 */
export function PlanPanel({
  plan,
  busy,
  includeFilenameMatches,
  allowAmbiguous,
  onToggleFilenameMatches,
  onToggleAmbiguous,
  onApply,
}: Props) {
  const skipCounts = useMemo(() => {
    const counts = new Map<SkipReason, number>()
    for (const entry of plan.skipped) {
      counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1)
    }
    return [...counts].sort((left, right) => right[1] - left[1])
  }, [plan.skipped])

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
          disabled={busy || plan.operations.length === 0}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
        >
          {busy ? t.applying : t.apply}
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
      </div>

      {plan.operations.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{t.planEmpty}</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto px-4 py-2 text-sm">
          {plan.operations.map((operation) => (
            <li key={operation.id} className="flex items-center gap-2 py-1">
              <span className="truncate text-neutral-400" title={operation.from}>
                {basename(operation.from)}
              </span>
              <span className="shrink-0 text-neutral-600">→</span>
              <span className="truncate" title={operation.to}>
                {basename(operation.to)}
              </span>
            </li>
          ))}
        </ul>
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
