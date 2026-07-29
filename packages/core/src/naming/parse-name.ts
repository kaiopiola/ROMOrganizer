/**
 * Interpretação de nome de arquivo — o **último recurso** da identificação.
 *
 * Só entra em cena quando nenhum hash casou. O resultado carrega `convention` justamente para
 * a interface poder avisar que aquele palpite não veio de DAT nenhum.
 */
export interface ParsedRomName {
  title: string
  /** Regiões por extenso, normalizadas (`USA`, `Europe`, `Japan`…). */
  regions: string[]
  /** Códigos ISO 639-1 minúsculos, quando o nome os declara. */
  languages: string[]
  /** Revisão como aparece no nome (`Rev A`, `v1.1`), sem os parênteses. */
  revision?: string
  /** Marcadores de status: `Beta`, `Proto`, `Demo`, `Sample`, `Unl`. */
  flags: string[]
  /** `[b]` do GoodTools/No-Intro: dump reconhecidamente ruim. */
  badDump: boolean
  convention: 'no-intro' | 'goodtools' | 'unknown'
}

/** Regiões que o No-Intro escreve por extenso. */
const NO_INTRO_REGIONS = new Map<string, string>(
  [
    'USA',
    'Europe',
    'Japan',
    'World',
    'Australia',
    'Brazil',
    'Canada',
    'China',
    'Korea',
    'Spain',
    'France',
    'Germany',
    'Italy',
    'Netherlands',
    'Sweden',
    'Norway',
    'Denmark',
    'Finland',
    'Poland',
    'Portugal',
    'Russia',
    'Asia',
    'Taiwan',
    'Hong Kong',
    'Greece',
    'India',
    'Israel',
    'Mexico',
    'New Zealand',
    'Scandinavia',
    'Latin America',
    'Unknown',
  ].map((region) => [region.toLowerCase(), region]),
)

/** Códigos de uma ou duas letras do GoodTools. */
const GOODTOOLS_REGIONS = new Map<string, string>([
  ['U', 'USA'],
  ['E', 'Europe'],
  ['J', 'Japan'],
  ['W', 'World'],
  ['A', 'Australia'],
  ['B', 'Brazil'],
  ['C', 'China'],
  ['K', 'Korea'],
  ['F', 'France'],
  ['G', 'Germany'],
  ['I', 'Italy'],
  ['S', 'Spain'],
  ['Nl', 'Netherlands'],
  ['Sw', 'Sweden'],
  ['No', 'Norway'],
  ['Ch', 'China'],
  ['Hk', 'Hong Kong'],
  ['UE', 'USA, Europe'],
  ['JU', 'Japan, USA'],
  ['UK', 'United Kingdom'],
  ['Unk', 'Unknown'],
])

const STATUS_FLAGS = new Map<string, string>(
  [
    'Beta',
    'Proto',
    'Prototype',
    'Demo',
    'Sample',
    'Unl',
    'Pirate',
    'Kiosk',
    'Alt',
    'Debug',
    'Program',
    'Enhancement Chip',
  ].map((flag) => [flag.toLowerCase(), flag]),
)

const REVISION_PATTERN = /^(rev\s*[\w.]+|v[\d.]+[a-z]?)$/i
const LANGUAGE_LIST_PATTERN = /^[A-Z][a-z](,[A-Z][a-z])*$/

/** Extrai os grupos entre parênteses e entre colchetes, preservando o que sobra como título. */
function splitGroups(name: string): { title: string; parens: string[]; brackets: string[] } {
  const parens: string[] = []
  const brackets: string[] = []

  const withoutGroups = name
    .replace(/\(([^()]*)\)/g, (_match, content: string) => {
      parens.push(content.trim())
      return ''
    })
    .replace(/\[([^[\]]*)\]/g, (_match, content: string) => {
      brackets.push(content.trim())
      return ''
    })

  return { title: withoutGroups.replace(/\s+/g, ' ').trim(), parens, brackets }
}

function stripExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName
}

export function parseRomName(fileName: string): ParsedRomName {
  const { title, parens, brackets } = splitGroups(stripExtension(fileName))

  const regions: string[] = []
  const languages: string[] = []
  const flags: string[] = []
  let revision: string | undefined
  let sawNoIntroRegion = false
  let sawGoodToolsRegion = false

  for (const group of parens) {
    if (group.length === 0) continue

    const byExtenso = NO_INTRO_REGIONS.get(group.toLowerCase())
    if (byExtenso !== undefined) {
      regions.push(byExtenso)
      sawNoIntroRegion = true
      continue
    }

    // "USA, Europe" — o No-Intro junta múltiplas regiões num grupo só.
    const parts = group.split(',').map((part) => part.trim())
    const allRegions = parts.every((part) => NO_INTRO_REGIONS.has(part.toLowerCase()))
    if (parts.length > 1 && allRegions) {
      regions.push(...parts.map((part) => NO_INTRO_REGIONS.get(part.toLowerCase()) as string))
      sawNoIntroRegion = true
      continue
    }

    const byCode = GOODTOOLS_REGIONS.get(group)
    if (byCode !== undefined) {
      regions.push(...byCode.split(', '))
      sawGoodToolsRegion = true
      continue
    }

    // "En,Fr,De" — lista de idiomas do No-Intro. Checado depois das regiões porque
    // códigos como "It" são ambíguos entre idioma e país.
    if (LANGUAGE_LIST_PATTERN.test(group)) {
      languages.push(...group.split(',').map((code) => code.toLowerCase()))
      continue
    }

    if (REVISION_PATTERN.test(group)) {
      revision = group
      continue
    }

    const flag = STATUS_FLAGS.get(group.toLowerCase())
    if (flag !== undefined) {
      flags.push(flag)
      continue
    }

    // Grupos como "(Beta 2)" ou "(Proto 1)": o prefixo é que interessa.
    const [firstWord = ''] = group.split(' ')
    const prefixFlag = STATUS_FLAGS.get(firstWord.toLowerCase())
    if (prefixFlag !== undefined) flags.push(group)
  }

  const badDump = brackets.some((tag) => /^b\d*$/i.test(tag))

  let convention: ParsedRomName['convention'] = 'unknown'
  if (sawNoIntroRegion) convention = 'no-intro'
  else if (sawGoodToolsRegion) convention = 'goodtools'

  return {
    title,
    regions: [...new Set(regions)],
    languages: [...new Set(languages)],
    ...(revision !== undefined && { revision }),
    flags,
    badDump,
    convention,
  }
}
