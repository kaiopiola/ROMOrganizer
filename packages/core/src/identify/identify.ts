import { open } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { isZipPath, listZipEntries, openZipEntry } from '../archive/zip.ts'
import type { DatIndex, IndexMatch, MatchedBy } from '../dat/index-db.ts'
import { hashChunkVariants, type RomHashes, type RomHashVariants } from '../hash/rom-hash.ts'
import { detectByteOrder, type ByteOrderDetection } from '../rom/byte-order.ts'
import { detectHeader, type HeaderDetection } from '../rom/header.ts'
import { parseRomName, type ParsedRomName } from '../naming/parse-name.ts'
import { buildFileName } from '../naming/template.ts'
import type { SystemRulePack } from '../systems/types.ts'

/**
 * Como o arquivo foi identificado. A interface mostra isto por linha: a diferença entre
 * "o hash bateu" e "o nome do arquivo sugeria" é a diferença entre certeza e palpite, e o
 * usuário precisa vê-la antes de aprovar um rename em lote.
 */
export type IdentificationMethod =
  /** Hash do conteúdo como está bateu com o DAT. */
  | 'hash'
  /** Bateu só depois de descontar o header — o caso clássico de `.nes` e `.smc`. */
  | 'hash-headerless'
  /** Nenhum hash bateu; o nome do arquivo seguia uma convenção conhecida. */
  | 'filename'
  /** Nada bateu e o nome não diz nada. */
  | 'unidentified'

export interface Identification {
  /** Caminho em disco. Para conteúdo compactado, é o caminho do próprio `.zip`. */
  filePath: string
  /** Nome do arquivo em disco. */
  fileName: string
  /** Entrada dentro do zip, quando o conteúdo veio de um arquivo compactado. */
  archiveEntry?: string
  /**
   * Verdadeiro quando o match saiu do CRC32 que o zip já armazena, sem descomprimir nada.
   * É o caminho rápido e cobre a maior parte de uma coleção zipada.
   */
  fromArchiveIndex?: boolean
  system: SystemRulePack
  method: IdentificationMethod
  /** Qual hash produziu o match, quando houve match. */
  matchedBy?: MatchedBy
  /** Ausente quando o match veio do CRC do zip — nesse caminho nada é descomprimido. */
  hashes?: RomHashes
  header: HeaderDetection
  byteOrder: ByteOrderDetection
  /** Candidatos do índice. Mais de um significa DATs discordando entre si. */
  matches: IndexMatch[]
  /** Verdadeiro quando os candidatos não concordam no nome do jogo. */
  ambiguous: boolean
  /** O que a heurística de nome extraiu — sempre preenchido, útil mesmo com match por hash. */
  parsedName: ParsedRomName
  /** Nome proposto para o arquivo em disco, ou `null` sem informação suficiente. */
  proposedName: string | null
}

/** Quantos bytes ler do início para detectar header e byte order. */
const PROBE_SIZE = 1024
const CHUNK_SIZE = 1024 * 1024

const NO_HEADER: HeaderDetection = { offset: 0, method: 'none' }
const CANONICAL_ORDER: ByteOrderDetection = { variantId: null, swapSize: 1 }

function fileChunks(path: string): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      const handle = await open(path, 'r')
      try {
        yield* handle.createReadStream({ highWaterMark: CHUNK_SIZE })
      } finally {
        await handle.close()
      }
    },
  }
}

/** Lê o suficiente do início de um stream para detectar header e byte order. */
async function readProbeFrom(chunks: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  let collected = 0

  for await (const chunk of chunks) {
    parts.push(chunk)
    collected += chunk.length
    if (collected >= PROBE_SIZE) break
  }

  const probe = new Uint8Array(Math.min(collected, PROBE_SIZE))
  let offset = 0
  for (const part of parts) {
    if (offset >= probe.length) break
    const slice = part.subarray(0, probe.length - offset)
    probe.set(slice, offset)
    offset += slice.length
  }
  return probe
}

/** Extensão de saída, preservando a do arquivo quando ele já tem uma. */
function outputExtension(system: SystemRulePack, fileName: string): string {
  const current = extname(fileName).replace(/^\./, '').toLowerCase()
  return current.length > 0 ? current : (system.extensions[0] as string)
}

function proposeName(
  system: SystemRulePack,
  matches: IndexMatch[],
  parsed: ParsedRomName,
  targetFileName: string,
): string | null {
  const ext = outputExtension(system, targetFileName)

  // Com match no DAT, o nome do jogo já vem no formato canônico — não há o que remontar.
  const [first] = matches
  if (first !== undefined) {
    return buildFileName('{title}.{ext}', { title: first.gameName, ext })
  }

  // Sem match, só vale propor algo se o nome seguia alguma convenção reconhecível.
  if (parsed.convention === 'unknown') return null

  return buildFileName(system.defaultTemplate, {
    title: parsed.title,
    region: parsed.regions.join(', '),
    revision: parsed.revision,
    ext,
  })
}

function buildResult(
  base: Pick<Identification, 'filePath' | 'fileName' | 'system'> & Partial<Identification>,
  matches: IndexMatch[],
  parsedName: ParsedRomName,
  targetFileName: string,
): Identification {
  const distinctGames = new Set(matches.map((match) => match.gameName))
  const proposedName = proposeName(base.system, matches, parsedName, targetFileName)

  return {
    header: NO_HEADER,
    byteOrder: CANONICAL_ORDER,
    method: 'unidentified',
    ...base,
    // Sem match no índice, quem decide entre palpite e desistência é o parser de nome —
    // depois do spread, para não ser sobrescrito pelo método que a fase de hash reportou.
    ...(matches.length === 0 && {
      method: proposedName === null ? ('unidentified' as const) : ('filename' as const),
    }),
    matches,
    ambiguous: distinctGames.size > 1,
    parsedName,
    proposedName,
  }
}

/**
 * Identifica conteúdo de ROM contra o índice, tentando as duas convenções de header.
 *
 * A ordem é deliberada: hash do conteúdo inteiro, depois hash sem header, e só então o nome.
 * Tentar as duas variantes resolve a discordância entre DATs headered e headerless sem
 * obrigar o usuário a saber qual base ele importou.
 */
async function identifyContent(
  chunks: () => AsyncIterable<Uint8Array>,
  system: SystemRulePack,
  index: DatIndex,
  contentSize: number,
): Promise<{
  variants: RomHashVariants
  header: HeaderDetection
  byteOrder: ByteOrderDetection
  method: IdentificationMethod
  matchedBy?: MatchedBy
  hashes: RomHashes
  matches: IndexMatch[]
}> {
  const probe = await readProbeFrom(chunks())
  const header = detectHeader(system.header, probe, contentSize)
  const byteOrder = detectByteOrder(system, probe)

  const variants = await hashChunkVariants(chunks(), {
    headerOffset: header.offset,
    swapSize: byteOrder.swapSize,
  })

  const attempts: [IdentificationMethod, RomHashes][] = [['hash', variants.full]]
  if (variants.stripped) attempts.push(['hash-headerless', variants.stripped])

  for (const [method, hashes] of attempts) {
    const result = index.lookup(hashes)
    if (result !== null) {
      return {
        variants,
        header,
        byteOrder,
        method,
        matchedBy: result.matchedBy,
        hashes,
        matches: result.matches,
      }
    }
  }

  return {
    variants,
    header,
    byteOrder,
    method: 'unidentified',
    hashes: variants.stripped ?? variants.full,
    matches: [],
  }
}

/** Identifica um arquivo de ROM solto em disco. */
export async function identifyFile(
  filePath: string,
  system: SystemRulePack,
  index: DatIndex,
): Promise<Identification> {
  const fileName = basename(filePath)
  const handle = await open(filePath, 'r')
  let size: number
  try {
    ;({ size } = await handle.stat())
  } finally {
    await handle.close()
  }

  const outcome = await identifyContent(() => fileChunks(filePath), system, index, size)
  const parsedName = parseRomName(fileName)

  return buildResult(
    {
      filePath,
      fileName,
      system,
      method: outcome.method,
      ...(outcome.matchedBy !== undefined && { matchedBy: outcome.matchedBy }),
      hashes: outcome.hashes,
      header: outcome.header,
      byteOrder: outcome.byteOrder,
    },
    outcome.matches,
    parsedName,
    fileName,
  )
}

/**
 * Identifica as ROMs dentro de um `.zip`.
 *
 * O CRC32 armazenado pelo próprio zip é tentado primeiro: quando ele casa, o jogo é
 * identificado sem descomprimir um byte, o que numa coleção zipada é a diferença entre um scan
 * de segundos e um de minutos. A descompressão só acontece quando esse atalho falha — o que na
 * prática significa header a descontar ou byte order a normalizar.
 *
 * O nome proposto é o do `.zip`; renomear a entrada interna exigiria reescrever o arquivo,
 * e reescrever o container de uma coleção inteira é risco desproporcional ao ganho.
 */
export async function identifyZip(
  zipPath: string,
  system: SystemRulePack,
  index: DatIndex,
): Promise<Identification[]> {
  const fileName = basename(zipPath)
  const accepted = new Set(system.extensions)

  const romEntries = (await listZipEntries(zipPath)).filter((entry) =>
    accepted.has(extname(entry.name).replace(/^\./, '').toLowerCase()),
  )

  const results: Identification[] = []

  for (const entry of romEntries) {
    const parsedName = parseRomName(entry.name)
    const shared = { filePath: zipPath, fileName, archiveEntry: entry.name, system }

    // Caminho rápido: o CRC do zip é o do conteúdo descomprimido.
    const quick = index.lookup({ crc32: entry.crc32 })
    if (quick !== null) {
      results.push(
        buildResult(
          { ...shared, method: 'hash', matchedBy: quick.matchedBy, fromArchiveIndex: true },
          quick.matches,
          parsedName,
          fileName,
        ),
      )
      continue
    }

    const outcome = await identifyContent(
      () => zipEntryChunks(zipPath, entry.name),
      system,
      index,
      entry.size,
    )

    results.push(
      buildResult(
        {
          ...shared,
          method: outcome.method,
          ...(outcome.matchedBy !== undefined && { matchedBy: outcome.matchedBy }),
          hashes: outcome.hashes,
          header: outcome.header,
          byteOrder: outcome.byteOrder,
          fromArchiveIndex: false,
        },
        outcome.matches,
        parsedName,
        fileName,
      ),
    )
  }

  return results
}

function zipEntryChunks(zipPath: string, entryName: string): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* await openZipEntry(zipPath, entryName)
    },
  }
}

/** Identifica um caminho, seja ele uma ROM solta ou um `.zip` com uma ou mais dentro. */
export async function identifyPath(
  path: string,
  system: SystemRulePack,
  index: DatIndex,
): Promise<Identification[]> {
  return isZipPath(path)
    ? identifyZip(path, system, index)
    : [await identifyFile(path, system, index)]
}
