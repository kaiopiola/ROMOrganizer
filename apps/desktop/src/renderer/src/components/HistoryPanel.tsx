import type { JournalSummary } from '../../../main/ipc-types.ts'
import { locale, t } from '../i18n.ts'

interface Props {
  journals: JournalSummary[]
  onUndo: (journalPath: string) => void
}

function formatTimestamp(value: string): string {
  if (value === '') return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale)
}

/**
 * Histórico de lotes aplicados, cada um desfazível.
 *
 * Cada linha corresponde a um journal em disco — que é o que torna o undo possível mesmo se o
 * app tiver sido fechado no meio do caminho.
 */
export function HistoryPanel({ journals, onUndo }: Props) {
  return (
    <section className="rounded-lg border border-neutral-800">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h2 className="text-sm font-medium">{t.historyTitle}</h2>
      </header>

      {journals.length === 0 ? (
        <p className="px-4 py-4 text-sm text-neutral-500">{t.historyEmpty}</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto">
          {journals.map((journal) => (
            <li
              key={journal.path}
              className="flex items-center justify-between gap-4 border-b border-neutral-900 px-4 py-2 text-sm last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block truncate">{formatTimestamp(journal.at)}</span>
                <span className="block text-xs text-neutral-500">
                  {t.journalOperations(journal.operations)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onUndo(journal.path)}
                className="shrink-0 rounded-md border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-800"
              >
                {t.undo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
