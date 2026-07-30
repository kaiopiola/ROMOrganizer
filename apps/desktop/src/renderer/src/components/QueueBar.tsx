import type { Library } from '../../../main/libraries.ts'
import type { Job } from '../useJobQueue.ts'
import { t } from '../i18n.ts'

interface Props {
  jobs: Job[]
  libraries: Library[]
  expanded: boolean
  onToggle: () => void
}

function labelFor(job: Job, libraries: Library[]): string {
  const library = libraries.find((candidate) => candidate.id === job.libraryId)
  const where = library === undefined ? job.libraryId : (library.directory.split('/').pop() ?? '')
  return `${job.kind === 'scan' ? t.jobScan : t.jobApply} · ${where}`
}

/**
 * Rodapé fixo da fila.
 *
 * Fica sempre visível enquanto houver trabalho, com o que está rodando agora e quantos vêm
 * depois — assim o progresso não disputa espaço com a lista de arquivos, e o usuário pode
 * continuar mexendo em outra biblioteca sem perder o acompanhamento de vista.
 */
export function QueueBar({ jobs, libraries, expanded, onToggle }: Props) {
  const running = jobs.find((job) => job.status === 'running')
  const pending = jobs.filter((job) => job.status === 'pending')
  const failed = jobs.filter((job) => job.status === 'failed')

  if (jobs.length === 0) return null

  const percent =
    running === undefined || running.total === 0 ? 0 : (running.done / running.total) * 100

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`flex w-full shrink-0 items-center gap-4 border-t px-6 py-2 text-left text-sm transition-colors ${
        expanded
          ? 'border-neutral-700 bg-neutral-800'
          : 'border-neutral-800 bg-neutral-900 hover:bg-neutral-800/70'
      }`}
    >
      <span className="min-w-0 flex-1">
        {running === undefined ? (
          <span className="text-neutral-400">
            {failed.length > 0 ? t.queueFinishedWithErrors(failed.length) : t.queueIdle}
          </span>
        ) : (
          <>
            <span className="block truncate">{labelFor(running, libraries)}</span>
            <span className="mt-1 block h-1 w-full overflow-hidden rounded bg-neutral-700">
              <span
                className="block h-full bg-emerald-500 transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </span>
          </>
        )}
      </span>

      {running !== undefined && running.total > 0 && (
        <span className="shrink-0 tabular-nums text-xs text-neutral-400">
          {running.done}/{running.total}
        </span>
      )}

      {pending.length > 0 && (
        <span className="shrink-0 rounded-full bg-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
          {t.queuePendingCount(pending.length)}
        </span>
      )}

      <span className="shrink-0 text-xs text-neutral-500">{expanded ? '▾' : '▴'}</span>
    </button>
  )
}
