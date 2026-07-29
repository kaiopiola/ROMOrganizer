import type { SystemRulePack } from '../systems/types.ts'
import { bytesToHex } from '../util/bytes.ts'

/**
 * O mesmo dump de N64 circula em três ordenações de bytes. Os DATs cobrem só a canônica
 * (`z64`), então um `.v64` precisa ser reordenado antes de hashear — senão nada bate.
 */
export interface ByteOrderDetection {
  /** Id da variante detectada, ou `null` quando o arquivo já está na ordem canônica. */
  variantId: string | null
  /** Tamanho do grupo a inverter. 1 significa "não mexer". */
  swapSize: 1 | 2 | 4
}

const CANONICAL: ByteOrderDetection = { variantId: null, swapSize: 1 }

export function detectByteOrder(pack: SystemRulePack, head: Uint8Array): ByteOrderDetection {
  const spec = pack.byteOrder
  if (!spec) return CANONICAL

  const magic = bytesToHex(head, spec.canonicalMagic.length / 2)
  if (magic === spec.canonicalMagic) return CANONICAL

  const variant = spec.variants.find((candidate) => candidate.magic === magic)
  return variant ? { variantId: variant.id, swapSize: variant.swapSize } : CANONICAL
}

/**
 * Reordena os bytes in-place, em grupos de `swapSize`.
 *
 * Um resto que não completa um grupo é deixado como está: reordenar parcialmente
 * produziria bytes diferentes dos do dump original e quebraria o hash de qualquer forma —
 * melhor não identificar do que identificar errado.
 */
export function applyByteSwap(buffer: Uint8Array, swapSize: 1 | 2 | 4): Uint8Array {
  if (swapSize === 1) return buffer

  const wholeGroups = Math.floor(buffer.length / swapSize) * swapSize
  for (let start = 0; start < wholeGroups; start += swapSize) {
    for (let i = 0, j = swapSize - 1; i < j; i += 1, j -= 1) {
      const left = buffer[start + i] as number
      buffer[start + i] = buffer[start + j] as number
      buffer[start + j] = left
    }
  }
  return buffer
}
