import { open } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { DatIndex, IndexMatch, MatchedBy } from '../dat/index-db.ts'
import { hashChunkVariants, type RomHashes } from '../hash/rom-hash.ts'
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
  /** Hash do arquivo como está em disco bateu com o DAT. */
  | 'hash'
  /** Bateu só depois de descontar o header — o caso clássico de `.nes` e `.smc`. */
  | 'hash-headerless'
  /** Nenhum hash bateu; o nome do arquivo seguia uma convenção conhecida. */
  | 'filename'
  /** Nada bateu e o nome não diz nada. */
  | 'unidentified'

export interface Identification {
  filePath: string
  fileName: string
  system: SystemRulePack
  method: IdentificationMethod
  /** Qual hash produziu o match, quando houve match. */
  matchedBy?: MatchedBy
  hashes: RomHashes
  header: HeaderDetection
  byteOrder: ByteOrderDetection
  /** Candidatos do índice. Mais de um significa DATs discordando entre si. */
  matches: IndexMatch[]
  /** Verdadeiro quando os candidatos não concordam no nome do jogo. */
  ambiguous: boolean
  /** O que a heurística de nome extraiu — sempre preenchido, útil mesmo com match por hash. */
  parsedName: ParsedRomName
  /** Nome proposto, ou `null` quando não há informação suficiente para propor um. */
  proposedName: string | null
}

/** Quantos bytes ler do início para detectar header e byte order. */
const PROBE_SIZE = 1024

async function readProbe(path: string): Promise<{ head: Uint8Array; size: number }> {
  const handle = await open(path, 'r')
  try {
    const { size } = await handle.stat()
    const head = new Uint8Array(Math.min(PROBE_SIZE, size))
    if (head.length > 0) await handle.read(head, 0, head.length, 0)
    return { head, size }
  } finally {
    await handle.close()
  }
}

/** Extensão de saída: o rule pack manda quando normaliza byte order (N64 vira sempre z64). */
function outputExtension(system: SystemRulePack, fileName: string): string {
  const current = extname(fileName).replace(/^\./, '').toLowerCase()
  return current.length > 0 ? current : (system.extensions[0] as string)
}

function proposeName(
  system: SystemRulePack,
  matches: IndexMatch[],
  parsed: ParsedRomName,
  fileName: string,
): string | null {
  const ext = outputExtension(system, fileName)

  // Com match no DAT, o nome do jogo já vem no formato canônico — não há o que remontar.
  const [first] = matches
  if (first !== undefined) {
    const datExtension = extname(first.romName).replace(/^\./, '').toLowerCase()
    return buildFileName('{title}.{ext}', {
      title: first.gameName,
      ext: system.byteOrder ? ext : datExtension || ext,
    })
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

/**
 * Identifica um arquivo contra o índice de DATs.
 *
 * A ordem de tentativa é deliberada: hash do arquivo inteiro, depois hash sem header, e só
 * então o nome. Tentar as duas variantes de hash resolve a discordância entre DATs headered e
 * headerless sem obrigar o usuário a saber qual base ele importou.
 */
export async function identifyFile(
  filePath: string,
  system: SystemRulePack,
  index: DatIndex,
): Promise<Identification> {
  const fileName = basename(filePath)
  const { head, size } = await readProbe(filePath)

  const header = detectHeader(system.header, head, size)
  const byteOrder = detectByteOrder(system, head)

  const variants = await hashChunkVariants(fileChunksOf(filePath), {
    headerOffset: header.offset,
    swapSize: byteOrder.swapSize,
  })

  const parsedName = parseRomName(fileName)

  const attempts: [IdentificationMethod, RomHashes][] = [['hash', variants.full]]
  if (variants.stripped) attempts.push(['hash-headerless', variants.stripped])

  for (const [method, hashes] of attempts) {
    const result = index.lookup(hashes)
    if (result === null) continue

    const distinctGames = new Set(result.matches.map((match) => match.gameName))
    return {
      filePath,
      fileName,
      system,
      method,
      matchedBy: result.matchedBy,
      hashes,
      header,
      byteOrder,
      matches: result.matches,
      ambiguous: distinctGames.size > 1,
      parsedName,
      proposedName: proposeName(system, result.matches, parsedName, fileName),
    }
  }

  const fallbackHashes = variants.stripped ?? variants.full
  const proposedName = proposeName(system, [], parsedName, fileName)

  return {
    filePath,
    fileName,
    system,
    method: proposedName === null ? 'unidentified' : 'filename',
    hashes: fallbackHashes,
    header,
    byteOrder,
    matches: [],
    ambiguous: false,
    parsedName,
    proposedName,
  }
}

function fileChunksOf(path: string): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      const handle = await open(path, 'r')
      try {
        yield* handle.createReadStream({ highWaterMark: 1024 * 1024 })
      } finally {
        await handle.close()
      }
    },
  }
}
