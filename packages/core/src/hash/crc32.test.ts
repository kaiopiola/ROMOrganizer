import { describe, expect, it } from 'vitest'
import { Crc32, crc32 } from './crc32.ts'
import { pseudoRandomBytes } from '../rom/fixtures.ts'

const encoder = new TextEncoder()

describe('crc32', () => {
  // Vetores conhecidos do CRC-32/ISO-HDLC, os mesmos que os DATs usam.
  it.each([
    ['', '00000000'],
    ['a', 'e8b7be43'],
    ['123456789', 'cbf43926'],
    ['The quick brown fox jumps over the lazy dog', '414fa339'],
  ])('bate com o vetor conhecido para %o', (input, expected) => {
    expect(crc32(encoder.encode(input))).toBe(expected)
  })

  it('sempre devolve 8 dígitos, mesmo com zeros à esquerda', () => {
    // Este conteúdo tem CRC começando em zero — o caso que quebra formatação ingênua.
    expect(crc32(new Uint8Array([0x00, 0x00]))).toHaveLength(8)
  })

  it('hashear em pedaços dá o mesmo resultado que de uma vez', () => {
    const data = pseudoRandomBytes(10_000, 42)

    const streamed = new Crc32()
    for (let offset = 0; offset < data.length; offset += 997) {
      streamed.update(data.subarray(offset, offset + 997))
    }

    expect(streamed.hex()).toBe(crc32(data))
  })
})
