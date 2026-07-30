import type { Identification } from '../identify/identify.ts'

/**
 * Um jogo dividido em vários discos.
 *
 * Emuladores tratam um `.m3u` como um jogo só, com troca de disco pelo menu — sem ele, um RPG
 * de quatro CDs aparece como quatro entradas na lista e obriga o usuário a saber qual carregar.
 */
export interface DiscGroup {
  /** Título sem o marcador de disco. */
  title: string
  /** Sufixo comum depois do título, como `(USA)`. */
  suffix: string
  discs: { number: number; filePath: string; fileName: string }[]
}

/**
 * Reconhece o marcador de disco no nome.
 *
 * Cobre as formas que No-Intro e Redump usam — `(Disc 1)` é a canônica, mas coleções reais
 * trazem `(CD 2)`, `(Disk 3)` e a forma em português.
 */
const DISC_PATTERN = /\((?:disc|disk|cd|disco)\s*(\d+)\)/i

export interface ParsedDiscName {
  title: string
  suffix: string
  discNumber: number
}

export function parseDiscName(fileName: string): ParsedDiscName | null {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  const match = DISC_PATTERN.exec(withoutExtension)
  if (match === null) return null

  const discNumber = Number(match[1])
  if (!Number.isInteger(discNumber) || discNumber < 1) return null

  return {
    title: withoutExtension.slice(0, match.index).trim(),
    // O que vem depois do marcador — `(Rev A)` e afins — faz parte da identidade do jogo.
    suffix: withoutExtension.slice(match.index + match[0].length).trim(),
    discNumber,
  }
}

/**
 * Agrupa identificações que são discos do mesmo jogo.
 *
 * Grupos de um disco só ficam de fora: um `.m3u` apontando para um único arquivo não resolve
 * nada e ainda polui a pasta.
 */
export function detectDiscGroups(identifications: readonly Identification[]): DiscGroup[] {
  const groups = new Map<string, DiscGroup>()

  for (const identification of identifications) {
    // O nome que importa é o proposto, quando existe: é ele que estará em disco depois de
    // aplicar o plano, e a playlist precisa apontar para o resultado, não para o estado atual.
    const name = identification.proposedName ?? identification.fileName
    const parsed = parseDiscName(name.split('/').pop() as string)
    if (parsed === null) continue

    const key = `${parsed.title}␟${parsed.suffix}`
    const group = groups.get(key) ?? { title: parsed.title, suffix: parsed.suffix, discs: [] }

    group.discs.push({
      number: parsed.discNumber,
      filePath: identification.filePath,
      fileName: name,
    })
    groups.set(key, group)
  }

  return [...groups.values()]
    .filter((group) => group.discs.length > 1)
    .map((group) => ({ ...group, discs: group.discs.sort((a, b) => a.number - b.number) }))
    .sort((left, right) => left.title.localeCompare(right.title))
}

/** Nome do `.m3u` de um grupo. */
export function m3uNameFor(group: DiscGroup): string {
  return `${[group.title, group.suffix].filter((part) => part !== '').join(' ')}.m3u`
}

/**
 * Conteúdo do `.m3u`: um caminho por linha, na ordem dos discos.
 *
 * Caminhos relativos de propósito — assim a pasta inteira pode ser copiada para outro lugar,
 * ou para um cartão, sem que a playlist quebre.
 */
export function buildM3u(group: DiscGroup): string {
  return `${group.discs.map((disc) => disc.fileName).join('\n')}\n`
}
