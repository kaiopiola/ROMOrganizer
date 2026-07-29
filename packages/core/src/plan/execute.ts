import { access, mkdir, open, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isCaseOnlyRename, type PlannedOperation, type RenamePlan } from './plan.ts'

/** Uma renomeação que de fato aconteceu. É a unidade de desfazer. */
export interface JournalRecord {
  from: string
  to: string
  at: string
}

export interface ExecutionFailure {
  from: string
  to: string
  reason: string
}

export interface ExecutionResult {
  applied: JournalRecord[]
  failed: ExecutionFailure[]
  /** Caminho do journal gravado, ou `null` quando nada foi aplicado. */
  journalPath: string | null
}

export interface ExecuteOptions {
  /** Onde gravar o journal. */
  journalDir: string
  /** Nome do arquivo de journal. Injetável para teste — por padrão vem do relógio. */
  journalName?: string
  signal?: AbortSignal
  onProgress?: (done: number, total: number, operation: PlannedOperation) => void
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Renomeia sem nunca sobrescrever.
 *
 * `fs.rename` sobrescreve o destino em silêncio — que para uma coleção de ROMs significa
 * apagar um arquivo do usuário sem aviso. A checagem prévia tem uma janela de corrida
 * teórica, mas o cenário real (um único app mexendo na pasta) a torna irrelevante frente ao
 * risco de perder um dump.
 */
async function safeRename(from: string, to: string): Promise<void> {
  // Case-only rename precisa de um passo intermediário: macOS e Windows são
  // case-insensitive, e para eles `Mario.nes` e `mario.nes` são o mesmo arquivo — o rename
  // direto vira no-op e o nome nunca muda.
  if (isCaseOnlyRename(from, to)) {
    const temporary = join(dirname(to), `.romorg-tmp-${Date.now()}-${basenameOf(to)}`)
    await rename(from, temporary)
    try {
      await rename(temporary, to)
    } catch (cause) {
      // Não deixa o arquivo do usuário parado num nome temporário.
      await rename(temporary, from)
      throw cause
    }
    return
  }

  if (await pathExists(to)) {
    throw new Error(`destino já existe: ${to}`)
  }

  // Templates com `/` organizam em subpastas, que podem ainda não existir.
  const targetDir = dirname(to)
  if (targetDir !== dirname(from)) await mkdir(targetDir, { recursive: true })

  await rename(from, to)
}

function basenameOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index === -1 ? path : path.slice(index + 1)
}

/**
 * Aplica o plano, gravando cada renomeação no journal **antes de seguir para a próxima**.
 *
 * O journal é JSONL com flush a cada linha: se o processo morrer no meio de um lote, o que
 * já aconteceu está registrado e continua sendo possível desfazer. Um journal escrito só no
 * final seria inútil exatamente quando mais importa.
 */
export async function executePlan(
  plan: RenamePlan,
  options: ExecuteOptions,
): Promise<ExecutionResult> {
  const applied: JournalRecord[] = []
  const failed: ExecutionFailure[] = []

  if (plan.operations.length === 0) {
    return { applied, failed, journalPath: null }
  }

  await mkdir(options.journalDir, { recursive: true })
  const journalPath = join(
    options.journalDir,
    options.journalName ?? `${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`,
  )

  const journal = await open(journalPath, 'a')
  try {
    let done = 0
    for (const operation of plan.operations) {
      options.signal?.throwIfAborted()

      try {
        await safeRename(operation.from, operation.to)
        const record: JournalRecord = {
          from: operation.from,
          to: operation.to,
          at: new Date().toISOString(),
        }
        await journal.write(`${JSON.stringify(record)}\n`)
        await journal.sync()
        applied.push(record)
      } catch (cause) {
        failed.push({
          from: operation.from,
          to: operation.to,
          reason: cause instanceof Error ? cause.message : String(cause),
        })
      }

      done += 1
      options.onProgress?.(done, plan.operations.length, operation)
    }
  } finally {
    await journal.close()
  }

  return { applied, failed, journalPath }
}

export interface UndoResult {
  restored: JournalRecord[]
  failed: ExecutionFailure[]
}

export async function readJournal(journalPath: string): Promise<JournalRecord[]> {
  const content = await readFile(journalPath, 'utf8')
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalRecord)
}

/**
 * Desfaz um lote, do fim para o começo.
 *
 * A ordem inversa importa: um lote pode ter movido A para o nome que B ocupava depois de B
 * sair de lá. Desfazer na ordem original recolocaria B antes de A liberar o nome.
 */
export async function undoFromJournal(journalPath: string): Promise<UndoResult> {
  const records = await readJournal(journalPath)
  const restored: JournalRecord[] = []
  const failed: ExecutionFailure[] = []

  for (const record of records.toReversed()) {
    try {
      await safeRename(record.to, record.from)
      restored.push(record)
    } catch (cause) {
      failed.push({
        from: record.to,
        to: record.from,
        reason: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  return { restored, failed }
}
