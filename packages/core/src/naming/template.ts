/**
 * Motor de template de nome de arquivo.
 *
 * Sintaxe:
 * - `{token}` — substituído pelo valor; vira string vazia se o token não tiver valor.
 * - `[ ... ]` — grupo opcional: some inteiro se **qualquer** token dentro dele estiver vazio.
 *
 * O grupo opcional existe por um motivo prático: sem ele, um template como
 * `{title} ({region}).{ext}` produz `Jogo ().sfc` quando a região é desconhecida. Com ele,
 * `{title}[ ({region})].{ext}` produz `Jogo.sfc` — sem parêntese órfão nem espaço solto.
 */

export type TemplateTokens = Record<string, string | undefined>

export class TemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateError'
  }
}

const TOKEN_PATTERN = /\{([a-z][a-zA-Z0-9]*)\}/g

/** Caracteres proibidos em nome de arquivo no Windows — e problemáticos em qualquer lugar. */
const ILLEGAL_CHARACTERS = /[<>:"/\\|?*]/g

/** Caracteres de controle nunca devem chegar a um nome de arquivo. */
// eslint-disable-next-line no-control-regex -- caracteres de controle são justamente o alvo
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g

/** Nomes que o Windows reserva para dispositivos, mesmo com extensão. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

function renderSegment(segment: string, tokens: TemplateTokens): { text: string; empty: boolean } {
  let sawEmpty = false

  const text = segment.replace(TOKEN_PATTERN, (_match, token: string) => {
    const value = tokens[token]
    if (value === undefined || value.length === 0) {
      sawEmpty = true
      return ''
    }
    return value
  })

  return { text, empty: sawEmpty }
}

export function renderTemplate(template: string, tokens: TemplateTokens): string {
  let output = ''
  let cursor = 0

  while (cursor < template.length) {
    const openIndex = template.indexOf('[', cursor)
    if (openIndex === -1) break

    const closeIndex = template.indexOf(']', openIndex)
    if (closeIndex === -1) {
      throw new TemplateError(`grupo opcional sem "]" de fechamento em: ${template}`)
    }

    output += renderSegment(template.slice(cursor, openIndex), tokens).text

    const group = renderSegment(template.slice(openIndex + 1, closeIndex), tokens)
    if (!group.empty) output += group.text

    cursor = closeIndex + 1
  }

  output += renderSegment(template.slice(cursor), tokens).text
  return output
}

/**
 * Torna um nome seguro em macOS, Windows e Linux ao mesmo tempo.
 *
 * A ferramenta renomeia coleções que costumam viver em drives externos e compartilhamentos de
 * rede, então vale usar sempre o denominador comum — um nome válido só no macOS quebraria na
 * hora de copiar a pasta para um cartão FAT32 ou para o PC.
 */
export function sanitizeFileName(name: string): string {
  let safe = name.replace(CONTROL_CHARACTERS, '').replace(ILLEGAL_CHARACTERS, '_')

  // O Windows rejeita nome terminado em ponto ou espaço.
  safe = safe.trim().replace(/[. ]+$/, '')

  const [stem = ''] = safe.split('.')
  if (RESERVED_NAMES.test(stem)) safe = `_${safe}`

  return safe.length > 0 ? safe : '_'
}

/** Aplica o template e devolve um nome já seguro para gravar em disco. */
export function buildFileName(template: string, tokens: TemplateTokens): string {
  return sanitizeFileName(renderTemplate(template, tokens))
}

/**
 * Aplica um template que pode conter `/` e devolve um caminho relativo já seguro.
 *
 * A barra é o que permite ao usuário organizar em subpastas com o mesmo template que nomeia o
 * arquivo — `{region}/{title}.{ext}`. Cada segmento é sanitizado **em separado**, senão a
 * própria barra seria trocada por `_` e o caminho viraria um nome único gigante.
 *
 * Segmentos vazios são descartados: com `{region}/{title}.{ext}` e região desconhecida, o
 * resultado é `Título.nes` na raiz, não `_/Título.nes`.
 */
export function buildRelativePath(template: string, tokens: TemplateTokens): string {
  return renderTemplate(template, tokens)
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map(sanitizeFileName)
    .join('/')
}

/** Tokens que os templates aceitam, para a interface poder listá-los. */
export const TEMPLATE_TOKENS = [
  'title',
  'region',
  'regions',
  'language',
  'revision',
  'year',
  'system',
  'manufacturer',
  'letter',
  'ext',
] as const

export type TemplateToken = (typeof TEMPLATE_TOKENS)[number]
