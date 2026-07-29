import { hexToBytes } from '../util/bytes.ts'

/**
 * Geradores de conteúdo sintético para teste.
 *
 * Nenhuma ROM real entra neste repositório. Um header sintético mais bytes previsíveis
 * exercitam toda a lógica de detecção, hash e normalização — o conteúdo do jogo é irrelevante
 * para o que estamos verificando.
 */

/** Bytes determinísticos a partir de uma semente, para o mesmo teste dar sempre o mesmo hash. */
export function pseudoRandomBytes(length: number, seed = 1): Uint8Array {
  const bytes = new Uint8Array(length)
  let state = seed >>> 0
  for (let i = 0; i < length; i += 1) {
    // xorshift32: barato e determinístico entre plataformas.
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    bytes[i] = state & 0xff
  }
  return bytes
}

/** Header iNES de 16 bytes: magic `NES\x1A` e o resto zerado. */
export function inesHeader(): Uint8Array {
  const header = new Uint8Array(16)
  header.set(hexToBytes('4e45531a'), 0)
  return header
}

/** Header SMC de 512 bytes. Não tem assinatura — só existe o tamanho para denunciá-lo. */
export function smcHeader(): Uint8Array {
  return new Uint8Array(512)
}
