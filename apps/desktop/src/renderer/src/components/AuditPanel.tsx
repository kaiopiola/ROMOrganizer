import { useMemo, useState } from 'react'
import type { AuditReportDto } from '../../../main/ipc-types.ts'
import { t } from '../i18n.ts'

type Filter = 'all' | 'missing' | 'have'

interface Props {
  libraryId: string
  report: AuditReportDto | null
  busy: boolean
  regions: string[]
  includeUnreleased: boolean
  onRun: () => void
  onRegionsChange: (regions: string[]) => void
  onIncludeUnreleasedChange: (value: boolean) => void
}

/**
 * Auditoria: o que a coleção tem e o que falta em relação ao DAT.
 *
 * A lista de faltantes é o produto principal — é ela que responde a pergunta que traz alguém
 * a uma ferramenta dessas. Os duplicados e os não reconhecidos vêm depois, porque são
 * problemas a resolver, não metas a atingir.
 */
export function AuditPanel({
  libraryId,
  report,
  busy,
  regions,
  includeUnreleased,
  onRun,
  onRegionsChange,
  onIncludeUnreleasedChange,
}: Props) {
  const [filter, setFilter] = useState<Filter>('missing')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    if (report === null) return []
    const needle = query.trim().toLowerCase()

    return report.games.filter((game) => {
      if (filter !== 'all' && game.status !== filter) return false
      return needle === '' || game.gameName.toLowerCase().includes(needle)
    })
  }, [report, filter, query])

  function toggleRegion(region: string): void {
    onRegionsChange(
      regions.includes(region)
        ? regions.filter((current) => current !== region)
        : [...regions, region],
    )
  }

  async function exportReport(format: 'csv' | 'markdown'): Promise<void> {
    if (report === null) return
    await window.romorg.audit.export(libraryId, report, format)
  }

  return (
    <section className="rounded-lg border border-neutral-800">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">{t.auditTitle}</h2>
          <p className="text-xs text-neutral-500">{t.auditHint}</p>
        </div>

        <div className="flex items-center gap-2">
          {report !== null && (
            <>
              <button
                type="button"
                onClick={() => void exportReport('csv')}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => void exportReport('markdown')}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
              >
                Markdown
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={busy}
            className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40"
          >
            {busy ? t.auditRunning : t.auditRun}
          </button>
        </div>
      </header>

      {report === null ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{t.auditEmpty}</p>
      ) : (
        <>
          <div className="border-b border-neutral-800 px-4 py-3">
            <div className="mb-2 flex items-baseline gap-3">
              <span className="text-2xl font-semibold tabular-nums">
                {report.completion.toFixed(1)}%
              </span>
              <span className="text-sm text-neutral-400">
                {t.auditSummary(report.have, report.total)}
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
              <div
                className="h-full bg-emerald-500 transition-[width]"
                style={{ width: `${report.completion}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-3">
            <div className="flex gap-1">
              {(['missing', 'have', 'all'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    filter === option
                      ? 'bg-neutral-700 text-neutral-100'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {option === 'missing'
                    ? t.auditMissing(report.missing)
                    : option === 'have'
                      ? t.auditHave(report.have)
                      : t.auditAll(report.total)}
                </button>
              ))}
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.auditSearch}
              className="min-w-40 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-600"
            />

            <label className="flex items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={includeUnreleased}
                onChange={(event) => onIncludeUnreleasedChange(event.target.checked)}
              />
              {t.auditIncludeUnreleased}
            </label>
          </div>

          {report.availableRegions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 px-4 py-2">
              <span className="mr-1 text-xs text-neutral-500">{t.auditRegions}</span>
              {report.availableRegions.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={`rounded border px-2 py-0.5 text-xs ${
                    regions.includes(region)
                      ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                      : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {region}
                </button>
              ))}
              {regions.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRegionsChange([])}
                  className="ml-1 text-xs text-neutral-500 hover:text-neutral-300"
                >
                  {t.auditClearRegions}
                </button>
              )}
            </div>
          )}

          <ul className="max-h-80 overflow-y-auto text-sm">
            {visible.map((game) => (
              <li
                key={`${game.datSource}-${game.gameName}`}
                className="flex items-center gap-3 border-b border-neutral-900 px-4 py-1.5 last:border-b-0"
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    game.status === 'have' ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`}
                />
                <span
                  className={`min-w-0 flex-1 truncate ${
                    game.status === 'have' ? '' : 'text-neutral-400'
                  }`}
                >
                  {game.gameName}
                </span>
              </li>
            ))}

            {visible.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-neutral-500">{t.auditNoResults}</li>
            )}
          </ul>

          {(report.duplicates.length > 0 || report.unrecognized.length > 0) && (
            <div className="grid gap-4 border-t border-neutral-800 px-4 py-3 sm:grid-cols-2">
              {report.duplicates.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-medium tracking-widest text-neutral-500 uppercase">
                    {t.auditDuplicates(report.duplicates.length)}
                  </h3>
                  <ul className="max-h-32 overflow-y-auto text-xs text-neutral-400">
                    {report.duplicates.map((duplicate) => (
                      <li key={duplicate.gameName} className="truncate py-0.5">
                        {duplicate.gameName} ({duplicate.filePaths.length})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.unrecognized.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-medium tracking-widest text-neutral-500 uppercase">
                    {t.auditUnrecognized(report.unrecognized.length)}
                  </h3>
                  <ul className="max-h-32 overflow-y-auto text-xs text-neutral-400">
                    {report.unrecognized.map((entry) => (
                      <li key={entry.filePath} className="truncate py-0.5" title={entry.filePath}>
                        {entry.fileName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
