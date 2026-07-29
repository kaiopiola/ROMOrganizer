import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RomHashVariants } from '../hash/rom-hash.ts'

/**
 * O que identifica uma versão de um arquivo.
 *
 * Tamanho e mtime juntos são o suficiente na prática: editar uma ROM sem mudar nenhum dos
 * dois exigiria reescrever o mesmo número de bytes e restaurar o mtime na mão. O caminho
 * entra porque o cache vive por biblioteca.
 */
export interface CacheKey {
  path: string
  /** Entrada dentro do zip, quando o conteúdo é compactado. */
  entry?: string
  size: number
  mtimeMs: number
}

interface CacheRecord {
  size: number
  mtimeMs: number
  variants: RomHashVariants
}

interface CacheFile {
  version: 1
  /** Chave: caminho, mais a entrada do zip quando houver. */
  entries: Record<string, CacheRecord>
}

function keyOf(key: CacheKey): string {
  return key.entry === undefined ? key.path : `${key.path}›${key.entry}`
}

/**
 * Cache de hashes, persistido junto da coleção.
 *
 * Hashear uma coleção inteira é a operação cara do projeto — reler dezenas de GB a cada scan
 * é o que separa um scan de segundos de um de minutos. Guardar só os **hashes**, e não o
 * resultado da identificação, é deliberado: trocar ou atualizar o DAT não invalida nada,
 * porque a consulta ao índice é refeita sempre e é barata.
 */
export class HashCache {
  private entries = new Map<string, CacheRecord>()
  private dirty = false

  get(key: CacheKey): RomHashVariants | undefined {
    const record = this.entries.get(keyOf(key))
    if (record === undefined) return undefined

    // Arquivo mudou desde que foi hasheado: o que está guardado não vale mais.
    if (record.size !== key.size || record.mtimeMs !== key.mtimeMs) return undefined

    return record.variants
  }

  set(key: CacheKey, variants: RomHashVariants): void {
    this.entries.set(keyOf(key), { size: key.size, mtimeMs: key.mtimeMs, variants })
    this.dirty = true
  }

  get size(): number {
    return this.entries.size
  }

  /**
   * Descarta entradas de arquivos que não existem mais.
   *
   * Sem isso o cache cresce para sempre: cada rename cria uma chave nova e deixa a antiga
   * para trás, e é o próprio app que renomeia.
   */
  retainOnly(livePaths: Iterable<string>): void {
    const live = new Set(livePaths)
    for (const key of [...this.entries.keys()]) {
      const path = key.split('›')[0] as string
      if (!live.has(path)) {
        this.entries.delete(key)
        this.dirty = true
      }
    }
  }

  static async load(filePath: string): Promise<HashCache> {
    const cache = new HashCache()
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as CacheFile
      if (parsed.version === 1 && typeof parsed.entries === 'object') {
        cache.entries = new Map(Object.entries(parsed.entries))
      }
    } catch {
      // Ausente na primeira execução, ou corrompido. Cache é otimização: recomeçar do zero
      // custa tempo, nunca correção.
    }
    return cache
  }

  /** Grava de forma atômica. Não faz nada quando nada mudou. */
  async save(filePath: string): Promise<void> {
    if (!this.dirty) return

    const data: CacheFile = { version: 1, entries: Object.fromEntries(this.entries) }
    await mkdir(dirname(filePath), { recursive: true })

    const temporary = `${filePath}.tmp`
    await writeFile(temporary, JSON.stringify(data), 'utf8')
    await rename(temporary, filePath)
    this.dirty = false
  }
}
