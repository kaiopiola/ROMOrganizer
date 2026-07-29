import type { HeaderRule } from '../systems/types.ts'

/**
 * Decide se os primeiros bytes de um arquivo são um header a descartar.
 *
 * Existem duas formas de detecção, e a diferença importa:
 *
 * - **Por assinatura** (NES): o header tem magic próprio. Detecção confiável.
 * - **Por tamanho** (SNES): o header SMC não tem assinatura nenhuma. A única pista é que
 *   o dump em si é múltiplo de 1024, então `tamanho % 1024 === 512` denuncia os 512 bytes
 *   extras. É heurística, e falha em ROMs com tamanho não-padrão — por isso o resultado
 *   carrega o `method`, para a UI poder mostrar em que o palpite se baseou.
 */
export interface HeaderDetection {
  /** Bytes a pular antes de hashear. Zero quando não há header. */
  offset: number
  method: 'none' | 'magic' | 'size'
}

const NO_HEADER: HeaderDetection = { offset: 0, method: 'none' }

function startsWithMagic(head: Uint8Array, magicHex: string): boolean {
  const byteLength = magicHex.length / 2
  if (head.length < byteLength) return false
  for (let i = 0; i < byteLength; i += 1) {
    const expected = Number.parseInt(magicHex.slice(i * 2, i * 2 + 2), 16)
    if (head[i] !== expected) return false
  }
  return true
}

/**
 * @param head Primeiros bytes do arquivo — basta cobrir o maior magic do rule pack.
 * @param fileSize Tamanho total em bytes, necessário para a detecção por módulo.
 */
export function detectHeader(
  rule: HeaderRule | undefined,
  head: Uint8Array,
  fileSize: number,
): HeaderDetection {
  if (!rule) return NO_HEADER

  if (rule.magic !== undefined) {
    return startsWithMagic(head, rule.magic) ? { offset: rule.size, method: 'magic' } : NO_HEADER
  }

  if (rule.moduloBase !== undefined) {
    const hasHeader = fileSize > rule.size && fileSize % rule.moduloBase === rule.size
    return hasHeader ? { offset: rule.size, method: 'size' } : NO_HEADER
  }

  return NO_HEADER
}
