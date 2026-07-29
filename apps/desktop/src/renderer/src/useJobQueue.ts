import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApplyProgress, PlanOptionsDto, ScanProgress } from '../../main/ipc-types.ts'

export type JobKind = 'scan' | 'apply'
export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled'

export interface Job {
  id: string
  libraryId: string
  kind: JobKind
  status: JobStatus
  done: number
  total: number
  /** Contagem do resultado, ou a mensagem do erro quando falhou. */
  detail: string | null
}

export interface JobRequest {
  libraryId: string
  kind: JobKind
  scanOptions: { useLibretro: boolean; localDatPaths: string[] }
  planOptions: PlanOptionsDto
  selectedIds: string[] | null
}

/**
 * Resultado de um trabalho concluído, para quem chamou atualizar a tela.
 *
 * A fila não guarda os dados do scan: quem sabe o que fazer com eles é a tela, e mantê-los
 * aqui duplicaria estado que já vive no processo main.
 */
export interface JobOutcome {
  libraryId: string
  kind: JobKind
  applied?: number
  cancelled?: boolean
}

let sequence = 0

/**
 * Fila de trabalhos por biblioteca.
 *
 * **Um de cada vez, na ordem.** Identificar e renomear são operações de disco; disparar várias
 * bibliotecas em paralelo disputaria o mesmo disco e costuma deixar o total mais lento, além de
 * tornar o progresso ilegível. A fila deixa enfileirar tudo de uma vez e acompanhar o que está
 * rodando e o que vem depois.
 */
export function useJobQueue(onFinished: (outcome: JobOutcome) => Promise<void> | void) {
  const [jobs, setJobs] = useState<Job[]>([])

  const queue = useRef<{ id: string; request: JobRequest }[]>([])
  const draining = useRef(false)
  const cancelledIds = useRef(new Set<string>())
  const finishedHandler = useRef(onFinished)

  useEffect(() => {
    finishedHandler.current = onFinished
  }, [onFinished])

  const update = useCallback((id: string, changes: Partial<Job>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...changes } : job)))
  }, [])

  // O progresso chega do main marcado com a biblioteca; basta encaminhá-lo à linha em execução.
  useEffect(() => {
    function forward(progress: ScanProgress | ApplyProgress, kind: JobKind): void {
      setJobs((current) =>
        current.map((job) =>
          job.libraryId === progress.libraryId && job.kind === kind && job.status === 'running'
            ? { ...job, done: progress.done, total: progress.total }
            : job,
        ),
      )
    }

    const offScan = window.romorg.scan.onProgress((progress) => forward(progress, 'scan'))
    const offApply = window.romorg.plan.onProgress((progress) => forward(progress, 'apply'))
    return () => {
      offScan()
      offApply()
    }
  }, [])

  const drain = useCallback(async () => {
    if (draining.current) return
    draining.current = true

    try {
      for (;;) {
        const next = queue.current.shift()
        if (next === undefined) return

        const { id, request } = next

        // Cancelado enquanto esperava a vez: nem chega a começar.
        if (cancelledIds.current.has(id)) {
          cancelledIds.current.delete(id)
          continue
        }

        update(id, { status: 'running' })

        try {
          if (request.kind === 'scan') {
            await window.romorg.scan.start(request.libraryId, request.scanOptions)
            update(id, { status: 'done' })
            await finishedHandler.current({ libraryId: request.libraryId, kind: 'scan' })
          } else {
            const result = await window.romorg.plan.apply(
              request.libraryId,
              request.planOptions,
              request.selectedIds,
            )
            update(id, {
              status: result.cancelled ? 'cancelled' : 'done',
              detail: String(result.applied),
            })
            await finishedHandler.current({
              libraryId: request.libraryId,
              kind: 'apply',
              applied: result.applied,
              cancelled: result.cancelled,
            })
          }
        } catch (cause) {
          update(id, {
            status: 'failed',
            detail: cause instanceof Error ? cause.message : String(cause),
          })
        }
      }
    } finally {
      draining.current = false
    }
  }, [update])

  const enqueue = useCallback(
    (request: JobRequest) => {
      sequence += 1
      const id = `job-${sequence}`

      setJobs((current) => [
        ...current,
        {
          id,
          libraryId: request.libraryId,
          kind: request.kind,
          status: 'pending',
          done: 0,
          total: 0,
          detail: null,
        },
      ])
      queue.current.push({ id, request })
      void drain()
    },
    [drain],
  )

  const cancel = useCallback((job: Job) => {
    if (job.status === 'pending') {
      cancelledIds.current.add(job.id)
      setJobs((current) =>
        current.map((entry) => (entry.id === job.id ? { ...entry, status: 'cancelled' } : entry)),
      )
      return
    }

    // Em execução: quem interrompe é o main, que tem o AbortController.
    if (job.kind === 'scan') void window.romorg.scan.cancel(job.libraryId)
    else void window.romorg.plan.cancel(job.libraryId)
  }, [])

  const clearFinished = useCallback(() => {
    setJobs((current) =>
      current.filter((job) => job.status === 'pending' || job.status === 'running'),
    )
  }, [])

  /** Trabalho ativo de uma biblioteca, para a lista lateral mostrar progresso na linha certa. */
  const activeFor = useCallback(
    (libraryId: string): Job | undefined =>
      jobs.find(
        (job) =>
          job.libraryId === libraryId && (job.status === 'running' || job.status === 'pending'),
      ),
    [jobs],
  )

  return { jobs, enqueue, cancel, clearFinished, activeFor }
}
