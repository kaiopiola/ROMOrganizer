import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SystemRulePack } from './types.ts'
import { RulePackError, validateRulePack } from './validate.ts'

/**
 * Coleção de rule packs indexada por id e por extensão.
 *
 * A extensão sozinha é um palpite fraco (`.bin` serve a meio mundo), por isso
 * `findByExtension` devolve todos os candidatos em vez de escolher um. Quem decide
 * é o sistema vinculado à pasta pelo usuário, ou o match por hash.
 */
export class SystemRegistry {
  private readonly byId = new Map<string, SystemRulePack>()
  private readonly byExtension = new Map<string, SystemRulePack[]>()

  constructor(packs: readonly SystemRulePack[]) {
    for (const pack of packs) {
      if (this.byId.has(pack.id)) {
        throw new RulePackError(pack.id, 'id duplicado no registry')
      }
      this.byId.set(pack.id, pack)
      for (const ext of pack.extensions) {
        const bucket = this.byExtension.get(ext)
        if (bucket) bucket.push(pack)
        else this.byExtension.set(ext, [pack])
      }
    }
  }

  get size(): number {
    return this.byId.size
  }

  all(): SystemRulePack[] {
    return [...this.byId.values()]
  }

  get(id: string): SystemRulePack | undefined {
    return this.byId.get(id)
  }

  /** Todos os sistemas que aceitam esta extensão (sem ponto, case-insensitive). */
  findByExtension(extension: string): SystemRulePack[] {
    return this.byExtension.get(extension.replace(/^\./, '').toLowerCase()) ?? []
  }
}

/** Lê e valida todos os `*.json` de um diretório de rule packs. */
export async function loadRulePacksFrom(directory: string): Promise<SystemRulePack[]> {
  const entries = await readdir(directory)
  const files = entries.filter((entry) => entry.endsWith('.json')).sort()

  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(join(directory, file), 'utf8')
      const pack = validateRulePack(JSON.parse(raw))
      if (`${pack.id}.json` !== file) {
        throw new RulePackError(pack.id, `id não corresponde ao nome do arquivo (${file})`)
      }
      return pack
    }),
  )
}
