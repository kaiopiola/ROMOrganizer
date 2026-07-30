import type { DatIndex, IndexMatch } from '../dat/index-db.ts'
import type { Identification } from '../identify/identify.ts'
import { parseRomName } from '../naming/parse-name.ts'

/**
 * Situação de um jogo do DAT em relação à coleção.
 *
 * `have` e `missing` respondem "o que falta"; `unrecognized` é o outro sentido — arquivos em
 * disco que nenhum DAT reivindica, que é onde moram dumps ruins, hacks e traduções.
 */
export type AuditStatus = 'have' | 'missing'

export interface AuditGame {
  gameName: string
  romName: string
  datSource: string
  regions: string[]
  languages: string[]
  status: AuditStatus
  /** Onde o arquivo está, quando presente. */
  filePath?: string
}

export interface AuditDuplicate {
  gameName: string
  /** Caminhos que apontam para o mesmo jogo. */
  filePaths: string[]
}

export interface AuditUnrecognized {
  filePath: string
  fileName: string
  /** Como o arquivo foi identificado — `filename` significa palpite, não match. */
  identifiedBy: Identification['method']
}

export interface AuditReport {
  /** Jogos do DAT considerados, depois dos filtros. */
  total: number
  have: number
  missing: number
  /** Percentual de completude, de 0 a 100. */
  completion: number
  games: AuditGame[]
  duplicates: AuditDuplicate[]
  unrecognized: AuditUnrecognized[]
  /** DATs que entraram na comparação. */
  datSources: string[]
}

export interface AuditOptions {
  /**
   * Regiões a considerar. Vazio ou ausente inclui todas.
   *
   * É o que permite auditar um set 1G1R: filtrar por `['USA', 'Europe']` deixa de fora as
   * versões japonesas, que de outra forma apareceriam todas como faltantes.
   */
  regions?: string[]
  /** Idiomas a considerar, em código de duas letras. Vazio inclui todos. */
  languages?: string[]
  /** Limita a um DAT específico. Útil quando há mais de um carregado. */
  datSource?: string
  /**
   * Inclui protótipos, betas, demos e afins.
   *
   * Falso por padrão: quem quer saber "o que falta da minha coleção" raramente considera
   * faltando um beta que nunca foi lançado.
   */
  includeUnreleased?: boolean
}

/** Marcadores que indicam material não lançado comercialmente. */
const UNRELEASED_FLAGS = new Set(['Beta', 'Proto', 'Prototype', 'Demo', 'Sample', 'Kiosk'])

function matchesFilters(parsed: ReturnType<typeof parseRomName>, options: AuditOptions): boolean {
  if (options.includeUnreleased !== true) {
    const isUnreleased = parsed.flags.some((flag) =>
      UNRELEASED_FLAGS.has(flag.split(' ')[0] as string),
    )
    if (isUnreleased) return false
  }

  const { regions, languages } = options

  if (regions !== undefined && regions.length > 0) {
    // Sem região declarada, o jogo entra: excluí-lo esconderia entradas legítimas de DATs que
    // simplesmente não trazem esse dado.
    if (parsed.regions.length > 0 && !parsed.regions.some((region) => regions.includes(region))) {
      return false
    }
  }

  if (languages !== undefined && languages.length > 0) {
    if (
      parsed.languages.length > 0 &&
      !parsed.languages.some((language) => languages.includes(language))
    ) {
      return false
    }
  }

  return true
}

/** Chave de um jogo: nome mais o DAT de origem, já que DATs diferentes podem nomear igual. */
function gameKey(entry: Pick<IndexMatch, 'gameName' | 'datSource'>): string {
  return `${entry.datSource}›${entry.gameName}`
}

/**
 * Compara a coleção identificada com o que os DATs listam.
 *
 * Trabalha sobre um scan já feito: auditar não relê disco nem rehasheia nada, é comparação
 * entre duas listas que já estão em memória.
 */
export function auditCollection(
  identifications: readonly Identification[],
  index: DatIndex,
  options: AuditOptions = {},
): AuditReport {
  const entries = index.allEntries(options.datSource)

  // Onde cada jogo do DAT está, quando está.
  const found = new Map<string, string[]>()
  const unrecognized: AuditUnrecognized[] = []

  for (const identification of identifications) {
    if (identification.matches.length === 0) {
      unrecognized.push({
        filePath: identification.filePath,
        fileName: identification.fileName,
        identifiedBy: identification.method,
      })
      continue
    }

    // Um arquivo pode casar em mais de um DAT; conta para todos, porque a auditoria é por DAT.
    for (const match of identification.matches) {
      const key = gameKey(match)
      const paths = found.get(key)
      const where =
        identification.archiveEntry === undefined
          ? identification.filePath
          : `${identification.filePath}›${identification.archiveEntry}`

      if (paths === undefined) found.set(key, [where])
      else if (!paths.includes(where)) paths.push(where)
    }
  }

  const games: AuditGame[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const key = gameKey(entry)

    // Um jogo com várias ROMs (multi-track) aparece uma vez na auditoria.
    if (seen.has(key)) continue
    seen.add(key)

    const parsed = parseRomName(entry.romName)
    if (!matchesFilters(parsed, options)) continue

    const paths = found.get(key)
    games.push({
      gameName: entry.gameName,
      romName: entry.romName,
      datSource: entry.datSource,
      regions: parsed.regions,
      languages: parsed.languages,
      status: paths === undefined ? 'missing' : 'have',
      ...(paths !== undefined && { filePath: paths[0] as string }),
    })
  }

  const duplicates: AuditDuplicate[] = [...found]
    .filter(([, paths]) => paths.length > 1)
    .map(([key, paths]) => ({ gameName: key.split('›')[1] as string, filePaths: paths }))
    .sort((left, right) => left.gameName.localeCompare(right.gameName))

  const have = games.filter((game) => game.status === 'have').length

  return {
    total: games.length,
    have,
    missing: games.length - have,
    completion: games.length === 0 ? 0 : (have / games.length) * 100,
    games: games.sort((left, right) => left.gameName.localeCompare(right.gameName)),
    duplicates,
    unrecognized,
    datSources: [...new Set(entries.map((entry) => entry.datSource))],
  }
}

/** Regiões presentes num relatório, para a interface montar os filtros. */
export function regionsIn(report: AuditReport): string[] {
  return [...new Set(report.games.flatMap((game) => game.regions))].sort()
}
