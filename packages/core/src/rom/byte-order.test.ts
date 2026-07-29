import { describe, expect, it } from 'vitest'
import { applyByteSwap, detectByteOrder } from './byte-order.ts'
import { pseudoRandomBytes } from './fixtures.ts'
import { concatBytes, hexToBytes } from '../util/bytes.ts'
import type { SystemRulePack } from '../systems/types.ts'

const N64: SystemRulePack = {
  id: 'n64',
  name: 'Nintendo 64',
  manufacturer: 'Nintendo',
  extensions: ['n64', 'v64', 'z64'],
  byteOrder: {
    canonicalMagic: '80371240',
    variants: [
      { id: 'v64', magic: '37804012', swapSize: 2 },
      { id: 'n64', magic: '40123780', swapSize: 4 },
    ],
  },
  defaultTemplate: '{title}.z64',
}

const GB: SystemRulePack = {
  id: 'gb',
  name: 'Game Boy',
  manufacturer: 'Nintendo',
  extensions: ['gb'],
  defaultTemplate: '{title}.{ext}',
}

describe('detectByteOrder', () => {
  it('não mexe num arquivo que já está na ordem canônica', () => {
    const file = concatBytes(hexToBytes('80371240'), pseudoRandomBytes(1024))
    expect(detectByteOrder(N64, file)).toEqual({ variantId: null, swapSize: 1 })
  })

  it('reconhece v64 (byteswapped) e n64 (little-endian)', () => {
    expect(detectByteOrder(N64, hexToBytes('37804012'))).toEqual({
      variantId: 'v64',
      swapSize: 2,
    })
    expect(detectByteOrder(N64, hexToBytes('40123780'))).toEqual({
      variantId: 'n64',
      swapSize: 4,
    })
  })

  it('trata magic desconhecido como canônico em vez de chutar uma variante', () => {
    expect(detectByteOrder(N64, hexToBytes('deadbeef')).swapSize).toBe(1)
  })

  it('ignora sistemas que não declaram byte order', () => {
    expect(detectByteOrder(GB, hexToBytes('37804012'))).toEqual({ variantId: null, swapSize: 1 })
  })
})

describe('applyByteSwap', () => {
  it('converte v64 e n64 de volta para a ordenação canônica', () => {
    expect(applyByteSwap(hexToBytes('37804012'), 2)).toEqual(hexToBytes('80371240'))
    expect(applyByteSwap(hexToBytes('40123780'), 4)).toEqual(hexToBytes('80371240'))
  })

  it('é involutiva: aplicar duas vezes devolve o original', () => {
    const original = pseudoRandomBytes(256, 7)
    const roundTrip = applyByteSwap(applyByteSwap(Uint8Array.from(original), 4), 4)
    expect(roundTrip).toEqual(original)
  })

  it('não altera nada com swapSize 1', () => {
    const bytes = pseudoRandomBytes(64, 3)
    expect(applyByteSwap(Uint8Array.from(bytes), 1)).toEqual(bytes)
  })

  it('deixa intacto o resto que não completa um grupo', () => {
    // 6 bytes com swapSize 4: só o primeiro grupo é invertido, os 2 finais ficam.
    const result = applyByteSwap(hexToBytes('00010203aabb'), 4)
    expect(result).toEqual(hexToBytes('03020100aabb'))
  })
})
