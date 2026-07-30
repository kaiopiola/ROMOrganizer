import { m3uNameFor, type DiscGroup } from './disc-groups.ts'
import type { Identification } from '../identify/identify.ts'
import type { SystemRulePack } from '../systems/types.ts'

/**
 * Entrada de uma playlist do RetroArch.
 *
 * Os nomes de campo são os que o RetroArch lê — não são escolha nossa, e mudá-los faz a
 * playlist ser ignorada em silêncio.
 */
export interface LplItem {
  path: string
  label: string
  core_path: string
  core_name: string
  crc32: string
  db_name: string
}

export interface Lpl {
  version: string
  default_core_path: string
  default_core_name: string
  label_display_mode: number
  right_thumbnail_mode: number
  left_thumbnail_mode: number
  sort_mode: number
  items: LplItem[]
}

export interface LplOptions {
  /**
   * Nome da base para o campo `db_name`.
   *
   * É o que liga a entrada às miniaturas do RetroArch: ele procura a capa em
   * `thumbnails/<db_name>/`. Sem o nome certo, a playlist funciona mas fica sem arte.
   */
  databaseName?: string
  /** Caminho do core a fixar. `DETECT` deixa o RetroArch escolher. */
  corePath?: string
  coreName?: string
  /**
   * Grupos de disco que ganharão `.m3u`.
   *
   * Quando informados, os discos individuais saem da playlist e entra uma linha por jogo,
   * apontando para o `.m3u`. É todo o propósito do agrupamento: listar `Disc 1` e `Disc 2`
   * separadamente ao lado do `.m3u` devolveria ao usuário exatamente a bagunça que ele
   * queria resolver.
   */
  discGroups?: readonly DiscGroup[]
  /** Pasta onde os `.m3u` são gravados, para montar o caminho da entrada. */
  directory?: string
}

/**
 * Caminho de uma entrada dentro de um zip.
 *
 * O RetroArch usa `#` para apontar um arquivo dentro do arquivo compactado — é o que permite
 * manter a coleção zipada e ainda assim ter a playlist apontando para o jogo certo.
 */
function pathOf(identification: Identification): string {
  return identification.archiveEntry === undefined
    ? identification.filePath
    : `${identification.filePath}#${identification.archiveEntry}`
}

/** O RetroArch espera o CRC em maiúsculas com o sufixo `|crc`. */
function crcFieldOf(identification: Identification): string {
  const crc = identification.hashes?.crc32 ?? identification.matches[0]?.crc32
  return crc === undefined || crc === null ? '00000000|crc' : `${crc.toUpperCase()}|crc`
}

function labelOf(identification: Identification): string {
  const [match] = identification.matches
  if (match !== undefined) return match.gameName

  // Sem match, o nome do arquivo sem extensão é o melhor rótulo disponível.
  const name = identification.proposedName ?? identification.fileName
  return (name.split('/').pop() as string).replace(/\.[^.]+$/, '')
}

/**
 * Monta a playlist do RetroArch para uma coleção identificada.
 *
 * Só entram arquivos que casaram com o DAT: uma playlist é uma lista de jogos, e incluir o que
 * não foi reconhecido encheria a interface do emulador de entradas com nome de arquivo cru.
 */
export function buildLpl(
  identifications: readonly Identification[],
  system: SystemRulePack,
  options: LplOptions = {},
): Lpl {
  const databaseName = options.databaseName ?? system.libretroDat ?? system.name
  const groups = options.discGroups ?? []

  const corePath = options.corePath ?? 'DETECT'
  const coreName = options.coreName ?? 'DETECT'
  const dbName = `${databaseName}.lpl`

  // Arquivos que serão representados pelo `.m3u` do grupo, e não por si mesmos.
  const grouped = new Set(groups.flatMap((group) => group.discs.map((disc) => disc.filePath)))

  const items: LplItem[] = identifications
    .filter(
      (identification) =>
        identification.matches.length > 0 && !grouped.has(identification.filePath),
    )
    .map((identification) => ({
      path: pathOf(identification),
      label: labelOf(identification),
      core_path: corePath,
      core_name: coreName,
      crc32: crcFieldOf(identification),
      db_name: dbName,
    }))

  for (const group of groups) {
    const fileName = m3uNameFor(group)
    const label = [group.title, group.suffix].filter((part) => part !== '').join(' ')

    items.push({
      path: options.directory === undefined ? fileName : `${options.directory}/${fileName}`,
      label,
      core_path: corePath,
      core_name: coreName,
      // O `.m3u` não tem CRC próprio; o RetroArch aceita o campo zerado.
      crc32: '00000000|crc',
      db_name: dbName,
    })
  }

  items.sort((left, right) => left.label.localeCompare(right.label))

  return {
    version: '1.5',
    default_core_path: options.corePath ?? '',
    default_core_name: options.coreName ?? '',
    label_display_mode: 0,
    right_thumbnail_mode: 0,
    left_thumbnail_mode: 0,
    sort_mode: 0,
    items,
  }
}

/** Nome de arquivo da playlist, no padrão que o RetroArch espera encontrar. */
export function lplNameFor(system: SystemRulePack): string {
  return `${system.libretroDat ?? system.name}.lpl`
}

export function serializeLpl(playlist: Lpl): string {
  return `${JSON.stringify(playlist, null, 2)}\n`
}
