import type { SystemRulePack } from '@romorg/core/browser'
import type { Library } from '../../../main/libraries.ts'
import type { Job, JobStatus } from '../useJobQueue.ts'
import { t } from '../i18n.ts'
import { SystemIcon } from './SystemIcon.tsx'

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: t.jobPending,
  running: t.jobRunning,
  done: t.jobDone,
  failed: t.jobFailed,
  cancelled: t.jobCancelled,
}

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
  systems: SystemRulePack[]
  icons: Record<string, string | null>
  onCancel: (job: Job) => void
  onClearFinished: () => void
}

/**
 * Tela dedicada da fila.
 *
 * Separa o que está em andamento do que já terminou — que é a divisão que importa quando se
 * enfileira várias bibliotecas e sai de perto. O que falhou fica no histórico com o motivo,
 * em vez de desaparecer.
 */
export function QueueScreen({ jobs, libraries, systems, icons, onCancel, onClearFinished }: Props) {
  const active = jobs.filter((job) => job.status === 'running' || job.status === 'pending')
  const finished = jobs.filter((job) => job.status !== 'running' && job.status !== 'pending')

  function renderJob(job: Job) {
    const library = libraries.find((candidate) => candidate.id === job.libraryId)
    const system = systems.find((candidate) => candidate.id === library?.systemId)
    const canCancel = job.status === 'running' || job.status === 'pending'

    return (
      <li
        key={job.id}
        className="flex items-center gap-3 border-b border-neutral-900 px-6 py-3 last:border-b-0"
      >
        <SystemIcon source={icons[library?.systemId ?? ''] ?? null} className="size-8 shrink-0" />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            {job.kind === 'scan' ? t.jobScan : t.jobApply} · {system?.name ?? job.libraryId}
          </span>
          <span className="block truncate text-xs text-neutral-500" title={library?.directory}>
            {library?.directory ?? ''}
          </span>

          {job.status === 'running' && job.total > 0 && (
            <span className="mt-1 block h-1 w-full overflow-hidden rounded bg-neutral-800">
              <span
                className="block h-full bg-emerald-500 transition-[width]"
                style={{ width: `${(job.done / job.total) * 100}%` }}
              />
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span className={`block text-xs ${STATUS_STYLE[job.status]}`}>
            {STATUS_LABEL[job.status]}
          </span>
          {job.status === 'running' && job.total > 0 && (
            <span className="block tabular-nums text-xs text-neutral-500">
              {job.done}/{job.total}
            </span>
          )}
          {job.status === 'done' && job.detail !== null && (
            <span className="block text-xs text-neutral-500">{t.applied(Number(job.detail))}</span>
          )}
        </span>

        {canCancel && (
          <button
            type="button"
            onClick={() => onCancel(job)}
            className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-xs hover:border-red-800 hover:text-red-400"
          >
            {t.cancel}
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-sm font-medium">{t.queueTitle}</h2>
        <p className="text-xs text-neutral-500">{t.queueSerialNote}</p>
      </header>

      {jobs.length === 0 ? (
        <p className="px-6 py-8 text-sm text-neutral-500">{t.queueEmpty}</p>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h3 className="px-6 pt-4 pb-1 text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t.queueActive}
              </h3>
              <ul>{active.map(renderJob)}</ul>
            </section>
          )}

          {finished.length > 0 && (
            <section>
              <div className="flex items-center justify-between px-6 pt-4 pb-1">
                <h3 className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                  {t.queueFinished}
                </h3>
                <button
                  type="button"
                  onClick={onClearFinished}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  {t.queueClear}
                </button>
              </div>
              <ul>{finished.map(renderJob)}</ul>

              {finished.some((job) => job.status === 'failed') && (
                <ul className="px-6 py-2">
                  {finished
                    .filter((job) => job.status === 'failed')
                    .map((job) => (
                      <li key={`${job.id}-error`} className="py-1 text-xs text-red-400">
                        {job.detail}
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
