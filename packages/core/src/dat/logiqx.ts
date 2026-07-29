import { XMLParser } from 'fast-xml-parser'

/** Uma ROM listada num DAT. Um `<game>` pode ter mais de uma (disco multi-track). */
export interface DatEntry {
  /** Nome do jogo — é o que vira nome de arquivo depois do rename. */
  gameName: string
  /** Nome do arquivo como o DAT o registra, com extensão. */
  romName: string
  size: number
  /** Ano de lançamento, quando o DAT o traz. */
  year?: string
  crc32?: string
  md5?: string
  sha1?: string
}

export interface ParsedDat {
  name: string
  description?: string
  version?: string
  entries: DatEntry[]
}

export class DatParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatParseError'
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Sem isto, um DAT com um único <game> vira objeto e um com vários vira array.
  isArray: (name) => name === 'game' || name === 'rom',
  // Nomes de jogo contêm & e entidades; não queremos que virem número ou booleano.
  parseAttributeValue: false,
  trimValues: true,
})

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined
  if (typeof value === 'number') return String(value)
  return undefined
}

/** Hashes no formato dos DATs vêm em maiúsculas e às vezes com zeros omitidos. */
function normalizeHash(value: unknown, expectedLength: number): string | undefined {
  const text = asString(value)?.toLowerCase()
  if (text === undefined || !/^[0-9a-f]+$/.test(text)) return undefined
  return text.padStart(expectedLength, '0')
}

/**
 * Lê um DAT no formato Logiqx XML — o que No-Intro, Redump e o libretro-database usam.
 *
 * O XML inteiro é carregado em memória: DATs de cartucho ficam na casa de poucos MB, e um
 * parser em stream custaria complexidade que só se paga em sets de arcade e mídia óptica.
 */
export function parseLogiqxDat(xml: string): ParsedDat {
  let document: Record<string, unknown>
  try {
    document = parser.parse(xml) as Record<string, unknown>
  } catch (cause) {
    throw new DatParseError(`XML inválido: ${String(cause)}`)
  }

  const datafile = document['datafile'] as Record<string, unknown> | undefined
  if (!datafile) {
    throw new DatParseError('elemento <datafile> não encontrado — isto não é um DAT Logiqx')
  }

  const header = (datafile['header'] ?? {}) as Record<string, unknown>
  const games = (datafile['game'] ?? []) as Record<string, unknown>[]

  const entries: DatEntry[] = []
  for (const game of games) {
    const gameName = asString(game['@name'])
    if (gameName === undefined) continue

    const roms = (game['rom'] ?? []) as Record<string, unknown>[]
    for (const rom of roms) {
      const romName = asString(rom['@name'])
      if (romName === undefined) continue

      const crc32 = normalizeHash(rom['@crc'], 8)
      const md5 = normalizeHash(rom['@md5'], 32)
      const sha1 = normalizeHash(rom['@sha1'], 40)

      // Entrada sem nenhum hash não é indexável — é o caso de DATs com roms `status="nodump"`.
      if (crc32 === undefined && md5 === undefined && sha1 === undefined) continue

      const year = asString(game['year'])

      entries.push({
        gameName,
        romName,
        size: Number(asString(rom['@size']) ?? 0),
        ...(year !== undefined && { year }),
        ...(crc32 !== undefined && { crc32 }),
        ...(md5 !== undefined && { md5 }),
        ...(sha1 !== undefined && { sha1 }),
      })
    }
  }

  const name = asString(header['name'])
  if (name === undefined) {
    throw new DatParseError('<header><name> ausente — sem isso não dá para saber de que sistema é')
  }

  return {
    name,
    ...(asString(header['description']) !== undefined && {
      description: asString(header['description']) as string,
    }),
    ...(asString(header['version']) !== undefined && {
      version: asString(header['version']) as string,
    }),
    entries,
  }
}
