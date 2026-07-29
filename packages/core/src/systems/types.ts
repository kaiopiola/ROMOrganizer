/**
 * Regra de header de ROM.
 *
 * DATs No-Intro são *headerless*: o CRC32 é calculado sobre os dados do jogo, sem o
 * cabeçalho que dumpers antigos prefixavam. Um `.nes` com header iNES nunca bate o
 * CRC se hasheado cru — daí a necessidade de descontar o header antes de hashear.
 */
export interface HeaderRule {
  /** Quantos bytes do início do arquivo não fazem parte do dump. */
  size: number
  /** Assinatura em hex que precisa estar no offset 0 para o header ser considerado presente. */
  magic?: string
  /**
   * Detecção por tamanho, usada quando não há assinatura (caso do SMC do SNES):
   * o header existe se `tamanho % moduloBase === size`.
   */
  moduloBase?: number
}

/** Ordenação de bytes alternativa do mesmo dump — hoje só o N64 precisa disso. */
export interface ByteOrderVariant {
  /** Identificador da variante, tipicamente a extensão associada (`v64`, `n64`). */
  id: string
  /** Assinatura em hex no offset 0 que identifica esta ordenação. */
  magic: string
  /**
   * Tamanho do grupo de bytes a inverter para chegar à ordenação canônica.
   * 2 = byteswap por palavra (v64), 4 = little-endian por dword (n64).
   */
  swapSize: 2 | 4
}

/**
 * Definição declarativa de um console. Contribuir com suporte a um sistema novo
 * deve ser um PR de um arquivo destes + teste, sem tocar em TypeScript.
 */
export interface SystemRulePack {
  /** Identificador estável, kebab-case. Nunca mude depois de publicado. */
  id: string
  /** Nome de exibição. */
  name: string
  /** Fabricante, para agrupar na UI. */
  manufacturer: string
  /** Extensões reconhecidas, minúsculas e sem ponto. */
  extensions: string[]
  /** Nome do DAT correspondente no libretro-database, quando existe. */
  libretroDat?: string
  /** Header a descontar antes de hashear, quando o sistema tem um. */
  header?: HeaderRule
  /** Ordenação canônica de bytes e suas variantes. */
  byteOrder?: {
    /** Assinatura em hex da ordenação canônica (a que o DAT usa). */
    canonicalMagic: string
    variants: ByteOrderVariant[]
  }
  /** Template de rename padrão. Ver `naming/template.ts` para os tokens aceitos. */
  defaultTemplate: string
}
