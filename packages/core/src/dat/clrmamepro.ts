import { DatParseError, type DatEntry, type ParsedDat } from './logiqx.ts'

/**
 * Parser do formato clrmamepro — o dialeto texto de DAT, usado pelo libretro-database.
 *
 * ```
 * clrmamepro (
 * 	name "Nintendo - Game Boy"
 * 	version "2026.05.02"
 * )
 * game (
 * 	name "Jogo (USA)"
 * 	region "USA"
 * 	rom ( name "Jogo (USA).gb" size 131072 crc 9A024415 sha1 952D... )
 * )
 * ```
 *
 * Não é XML: é uma gramática de blocos `nome ( chave valor... )` com strings entre aspas.
 * Vale ter os dois parsers porque as duas fontes que o projeto aceita divergem — No-Intro
 * distribui Logiqx, o libretro-database distribui isto.
 */

// Membros separados em vez de `kind: 'open' | 'close'`: só assim o TypeScript estreita a
// união depois de descartar os delimitadores e enxerga o `value`.
type Token =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'word'; value: string }
  | { kind: 'string'; value: string }

function* tokenize(text: string): Generator<Token> {
  let cursor = 0

  while (cursor < text.length) {
    const char = text[cursor] as string

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      cursor += 1
      continue
    }

    if (char === '#') {
      const lineEnd = text.indexOf('\n', cursor)
      cursor = lineEnd === -1 ? text.length : lineEnd
      continue
    }

    if (char === '(') {
      cursor += 1
      yield { kind: 'open' }
      continue
    }

    if (char === ')') {
      cursor += 1
      yield { kind: 'close' }
      continue
    }

    if (char === '"') {
      cursor += 1
      let value = ''
      while (cursor < text.length && text[cursor] !== '"') {
        // Barra invertida escapa o próximo caractere — aparece em títulos com aspas.
        if (text[cursor] === '\\' && cursor + 1 < text.length) cursor += 1
        value += text[cursor]
        cursor += 1
      }
      if (cursor >= text.length) throw new DatParseError('string sem aspas de fechamento')
      cursor += 1
      yield { kind: 'string', value }
      continue
    }

    let value = ''
    while (cursor < text.length && !/[\s()"]/.test(text[cursor] as string)) {
      value += text[cursor]
      cursor += 1
    }
    yield { kind: 'word', value }
  }
}

/** Um bloco `nome ( ... )`, com pares chave/valor e blocos aninhados. */
interface Block {
  fields: Map<string, string>
  children: { name: string; block: Block }[]
}

function parseBlock(tokens: Token[], start: number): { block: Block; next: number } {
  const block: Block = { fields: new Map(), children: [] }
  let cursor = start

  while (cursor < tokens.length) {
    const token = tokens[cursor] as Token

    if (token.kind === 'close') return { block, next: cursor + 1 }

    if (token.kind !== 'word') {
      throw new DatParseError(`esperava um nome de campo, veio ${token.kind}`)
    }

    const next = tokens[cursor + 1]
    if (next === undefined) throw new DatParseError(`campo "${token.value}" sem valor`)

    if (next.kind === 'open') {
      const nested = parseBlock(tokens, cursor + 2)
      block.children.push({ name: token.value, block: nested.block })
      cursor = nested.next
      continue
    }

    if (next.kind === 'close') {
      throw new DatParseError(`campo "${token.value}" sem valor`)
    }

    // O último valor vence: DATs reais repetem chaves eventualmente.
    block.fields.set(token.value, next.value)
    cursor += 2
  }

  throw new DatParseError('bloco sem ")" de fechamento')
}

function normalizeHash(value: string | undefined, expectedLength: number): string | undefined {
  if (value === undefined) return undefined
  const text = value.toLowerCase()
  if (!/^[0-9a-f]+$/.test(text)) return undefined
  return text.padStart(expectedLength, '0')
}

export function parseClrMameProDat(text: string): ParsedDat {
  const tokens = [...tokenize(text)]

  let name: string | undefined
  let description: string | undefined
  let version: string | undefined
  const entries: DatEntry[] = []

  let cursor = 0
  while (cursor < tokens.length) {
    const token = tokens[cursor] as Token
    if (token.kind !== 'word') {
      throw new DatParseError('esperava um bloco de topo (clrmamepro, game, resource…)')
    }
    if (tokens[cursor + 1]?.kind !== 'open') {
      throw new DatParseError(`bloco "${token.value}" sem "(" de abertura`)
    }

    const { block, next } = parseBlock(tokens, cursor + 2)
    cursor = next

    if (token.value === 'clrmamepro' || token.value === 'emulator') {
      name ??= block.fields.get('name')
      description ??= block.fields.get('description')
      version ??= block.fields.get('version')
      continue
    }

    if (token.value !== 'game' && token.value !== 'machine') continue

    const gameName = block.fields.get('name')
    if (gameName === undefined) continue

    for (const child of block.children) {
      if (child.name !== 'rom') continue

      const romName = child.block.fields.get('name')
      if (romName === undefined) continue

      const crc32 = normalizeHash(child.block.fields.get('crc'), 8)
      const md5 = normalizeHash(child.block.fields.get('md5'), 32)
      const sha1 = normalizeHash(child.block.fields.get('sha1'), 40)
      if (crc32 === undefined && md5 === undefined && sha1 === undefined) continue

      entries.push({
        gameName,
        romName,
        size: Number(child.block.fields.get('size') ?? 0),
        ...(crc32 !== undefined && { crc32 }),
        ...(md5 !== undefined && { md5 }),
        ...(sha1 !== undefined && { sha1 }),
      })
    }
  }

  if (name === undefined) {
    throw new DatParseError('bloco clrmamepro sem "name" — sem isso não dá para saber o sistema')
  }

  return {
    name,
    ...(description !== undefined && { description }),
    ...(version !== undefined && { version }),
    entries,
  }
}
