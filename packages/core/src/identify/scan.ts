import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { DatIndex } from '../dat/index-db.ts'
import type { SystemRulePack } from '../systems/types.ts'
import { identifyFile, type Identification } from './identify.ts'

export interface ScanOptions {
  /** Percorre subpastas. */
  recursive?: boolean
  /** Quantos arquivos identificar em paralelo. */
  concurrency?: number
  /** Chamado a cada arquivo concluído, para barra de progresso. */
  onProgress?: (done: number, total: number, current: Identification) => void
  /** Permite cancelar um scan longo. */
  signal?: AbortSignal
}

export interface ScanSummary {
  /** Resultados na ordem em que os arquivos foram encontrados. */
  results: Identification[]
  /** Arquivos que a leitura falhou, com o motivo. */
  failures: { filePath: string; reason: string }[]
}

/** Lixo que convive com ROMs em pastas de coleção e não deve nem aparecer no relatório. */
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

async function collectFiles(
  directory: string,
  system: SystemRulePack,
  recursive: boolean,
): Promise<string[]> {
  const accepted = new Set(system.extensions)
  const found: string[] = []

  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      if (recursive) found.push(...(await collectFiles(fullPath, system, recursive)))
      continue
    }
    if (!entry.isFile() || IGNORED_NAMES.has(entry.name)) continue

    const extension = extname(entry.name).replace(/^\./, '').toLowerCase()
    if (accepted.has(extension)) found.push(fullPath)
  }

  return found.sort()
}

/**
 * Identifica todos os arquivos de uma pasta que pertencem ao sistema informado.
 *
 * A concorrência é limitada porque um scan sem freio em coleção grande satura o disco e deixa
 * a interface sem resposta. O padrão é conservador de propósito: em HDD e drive de rede, mais
 * paralelismo chega a piorar o tempo total.
 */
export async function scanDirectory(
  directory: string,
  system: SystemRulePack,
  index: DatIndex,
  options: ScanOptions = {},
): Promise<ScanSummary> {
  const files = await collectFiles(directory, system, options.recursive ?? false)
  const concurrency = Math.max(1, options.concurrency ?? 4)

  const results: Identification[] = new Array<Identification>(files.length)
  const failures: ScanSummary['failures'] = []
  let nextIndex = 0
  let done = 0

  async function worker(): Promise<void> {
    for (;;) {
      const current = nextIndex
      nextIndex += 1
      if (current >= files.length) return
      options.signal?.throwIfAborted()

      const filePath = files[current] as string
      try {
        const identification = await identifyFile(filePath, system, index)
        results[current] = identification
        done += 1
        options.onProgress?.(done, files.length, identification)
      } catch (cause) {
        failures.push({ filePath, reason: cause instanceof Error ? cause.message : String(cause) })
        done += 1
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()))

  return { results: results.filter((result) => result !== undefined), failures }
}
