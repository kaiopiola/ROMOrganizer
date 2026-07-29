import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fetchLibretroDatsFor, parseDat, type ParsedDat, type SystemRulePack } from '@romorg/core'

/**
 * Cache em disco dos DATs baixados do libretro-database.
 *
 * Sem ele, cada scan refaria o download de centenas de KB por sistema — desnecessário para o
 * usuário e desnecessário para o repositório de terceiros que hospeda os arquivos.
 */
export class DatCache {
  private readonly directory: string
  private readonly maxAgeMs: number

  constructor(directory: string, maxAgeDays = 7) {
    this.directory = directory
    this.maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  }

  private fileFor(systemId: string): string {
    return join(this.directory, `${systemId}.json`)
  }

  private async readFresh(systemId: string): Promise<ParsedDat[] | null> {
    try {
      const path = this.fileFor(systemId)
      const { mtimeMs } = await stat(path)
      if (Date.now() - mtimeMs > this.maxAgeMs) return null
      return JSON.parse(await readFile(path, 'utf8')) as ParsedDat[]
    } catch {
      return null
    }
  }

  /**
   * DATs do sistema, do cache quando ainda válido.
   *
   * `force` refaz o download mesmo com cache fresco. Se a rede falhar e houver cache — mesmo
   * vencido — ele é usado: um DAT de semana passada identifica muito mais que DAT nenhum.
   */
  async getFor(system: SystemRulePack, force = false): Promise<ParsedDat[]> {
    if (!force) {
      const cached = await this.readFresh(system.id)
      if (cached !== null) return cached
    }

    try {
      const { parsed } = await fetchLibretroDatsFor(system)
      await mkdir(this.directory, { recursive: true })
      await writeFile(this.fileFor(system.id), JSON.stringify(parsed), 'utf8')
      return parsed
    } catch (cause) {
      const stale = await this.readStale(system.id)
      if (stale !== null) return stale
      throw cause
    }
  }

  private async readStale(systemId: string): Promise<ParsedDat[] | null> {
    try {
      return JSON.parse(await readFile(this.fileFor(systemId), 'utf8')) as ParsedDat[]
    } catch {
      return null
    }
  }

  /** Sistemas com DAT em cache e quando foram atualizados. */
  async status(): Promise<{ systemId: string; updatedAt: string }[]> {
    try {
      const entries = await readdir(this.directory)
      return Promise.all(
        entries
          .filter((entry) => entry.endsWith('.json'))
          .map(async (entry) => ({
            systemId: entry.replace(/\.json$/, ''),
            updatedAt: new Date((await stat(join(this.directory, entry))).mtimeMs).toISOString(),
          })),
      )
    } catch {
      return []
    }
  }
}

/** Lê e parseia um DAT que o usuário apontou manualmente. */
export async function loadLocalDat(path: string): Promise<ParsedDat> {
  return parseDat(await readFile(path, 'utf8'))
}
