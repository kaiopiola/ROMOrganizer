import type { Library } from '../../../main/libraries.ts'
import type { Job, JobStatus } from '../useJobQueue.ts'
import { t } from '../i18n.ts'

const STATUS_STYLE: Record<JobStatus, string> = {
  pending: 'text-neutral-500',
  running: 'text-emerald-400',
  done: 'text-neutral-400',
  failed: 'text-red-400',
  cancelled: 'text-neutral-500',
}

interface Props {
  jobs: Job[]
  libraries: Library[]
  onCancel: (job: Job) => void
  onClearFinished: () => void
}

/**
 * A fila.
 *
 * Existe para o usuário poder enfileirar várias bibliotecas e sair de perto: mostra o que está
 * rodando, o que vem depois e o que já terminou — inclusive o que falhou, que de outra forma
 * sumiria sem deixar rastro.
 */
export function QueuePanel({ jobs, libraries, onCancel, onClearFinished }: Props) {
  if (jobs.length === 0) return null

  const finishedCount = jobs.filter(
    (job) => job.status !== 'pending' && job.status !== 'running',
  ).length

  function labelFor(job: Job): string {
    const library = libraries.find((candidate) => candidate.id === job.libraryId)
    const where = library === undefined ? job.libraryId : library.directory.split('/').pop()
    return `${job.kind === 'scan' ? t.jobScan : t.jobApply} · ${where}`
  }

  function statusTextFor(job: Job): string {
    switch (job.status) {
      case 'pending':
        return t.jobPending
      case 'running':
        return job.total > 0 ? `${job.done}/${job.total}` : t.jobRunning
      case 'done':
        return job.detail === null ? t.jobDone : t.applied(Number(job.detail))
      case 'cancelled':
        return t.jobCancelled
      case 'failed':
        return job.detail ?? t.jobFailed
    }
  }

  return (
    <section className="rounded-lg border border-neutral-800">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h2 className="text-sm font-medium">
          {t.queueTitle} · {jobs.length}
        </h2>
        {finishedCount > 0 && (
          <button
            type="button"
            onClick={onClearFinished}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            {t.queueClear}
          </button>
        )}
      </header>

      <ul className="max-h-48 overflow-y-auto">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="flex items-center gap-3 border-b border-neutral-900 px-4 py-2 text-sm last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">{labelFor(job)}</span>

            {job.status === 'running' && job.total > 0 && (
              <span className="h-1 w-24 shrink-0 overflow-hidden rounded bg-neutral-800">
                <span
                  className="block h-full bg-emerald-500 transition-[width]"
                  style={{ width: `${(job.done / job.total) * 100}%` }}
                />
              </span>
            )}

            <span className={`shrink-0 text-xs ${STATUS_STYLE[job.status]}`}>
              {statusTextFor(job)}
            </span>

            {(job.status === 'pending' || job.status === 'running') && (
              <button
                type="button"
                onClick={() => onCancel(job)}
                className="shrink-0 text-xs text-neutral-500 hover:text-red-400"
              >
                {t.cancel}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
