import { describe, expect, it } from 'vitest'
import { detectHeader } from './header.ts'
import { inesHeader, pseudoRandomBytes, smcHeader } from './fixtures.ts'
import { concatBytes } from '../util/bytes.ts'
import type { HeaderRule } from '../systems/types.ts'

const INES: HeaderRule = { size: 16, magic: '4e45531a' }
const SMC: HeaderRule = { size: 512, moduloBase: 1024 }

describe('detectHeader — detecção por assinatura (NES)', () => {
  it('reconhece o header iNES e devolve o offset a pular', () => {
    const file = concatBytes(inesHeader(), pseudoRandomBytes(32 * 1024))
    expect(detectHeader(INES, file, file.length)).toEqual({ offset: 16, method: 'magic' })
  })

  it('não inventa header quando a assinatura não está lá', () => {
    const file = pseudoRandomBytes(32 * 1024)
    expect(detectHeader(INES, file, file.length)).toEqual({ offset: 0, method: 'none' })
  })

  it('não confunde uma assinatura parcial com header completo', () => {
    // "NES" sem o 0x1A final: é outro formato, não um iNES.
    const file = concatBytes(new Uint8Array([0x4e, 0x45, 0x53, 0x00]), pseudoRandomBytes(1024))
    expect(detectHeader(INES, file, file.length).offset).toBe(0)
  })
})

describe('detectHeader — detecção por tamanho (SNES)', () => {
  it('reconhece os 512 bytes extras do SMC', () => {
    const file = concatBytes(smcHeader(), pseudoRandomBytes(512 * 1024))
    expect(detectHeader(SMC, file, file.length)).toEqual({ offset: 512, method: 'size' })
  })

  it('deixa em paz um dump que já é múltiplo de 1024', () => {
    const file = pseudoRandomBytes(512 * 1024)
    expect(detectHeader(SMC, file, file.length)).toEqual({ offset: 0, method: 'none' })
  })

  it('não trata um arquivo de exatamente 512 bytes como só header', () => {
    // Seria um arquivo vazio depois de descontar o header — mais provável ser lixo
    // do que um dump legítimo, e descontar levaria a hashear zero byte.
    expect(detectHeader(SMC, new Uint8Array(512), 512).offset).toBe(0)
  })
})

describe('detectHeader — sistemas sem header', () => {
  it('devolve offset zero quando o rule pack não declara header', () => {
    expect(detectHeader(undefined, pseudoRandomBytes(64), 64)).toEqual({
      offset: 0,
      method: 'none',
    })
  })
})
