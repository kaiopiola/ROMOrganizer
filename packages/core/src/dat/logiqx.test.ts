import { describe, expect, it } from 'vitest'
import { DatParseError, parseLogiqxDat } from './logiqx.ts'

function dat(body: string, headerName = 'Test System'): string {
  return `<?xml version="1.0"?>
<datafile>
  <header>
    <name>${headerName}</name>
    <description>${headerName} (Parent-Clone)</description>
    <version>20260101-000000</version>
  </header>
  ${body}
</datafile>`
}

const ONE_GAME = dat(`
  <game name="Super Test Bros. (USA)">
    <description>Super Test Bros. (USA)</description>
    <rom name="Super Test Bros. (USA).sfc" size="524288" crc="B19ED489"
         md5="0123456789ABCDEF0123456789ABCDEF"
         sha1="0123456789ABCDEF0123456789ABCDEF01234567"/>
  </game>`)

describe('parseLogiqxDat', () => {
  it('lê o cabeçalho e as entradas', () => {
    const parsed = parseLogiqxDat(ONE_GAME)

    expect(parsed.name).toBe('Test System')
    expect(parsed.version).toBe('20260101-000000')
    expect(parsed.entries).toEqual([
      {
        gameName: 'Super Test Bros. (USA)',
        romName: 'Super Test Bros. (USA).sfc',
        size: 524288,
        crc32: 'b19ed489',
        md5: '0123456789abcdef0123456789abcdef',
        sha1: '0123456789abcdef0123456789abcdef01234567',
      },
    ])
  })

  it('normaliza hashes para minúsculo, que é como o hasher os produz', () => {
    expect(parseLogiqxDat(ONE_GAME).entries[0]?.crc32).toBe('b19ed489')
  })

  it('completa com zero à esquerda um CRC que o DAT abreviou', () => {
    const parsed = parseLogiqxDat(
      dat(`<game name="Curto"><rom name="curto.bin" size="16" crc="1A2B"/></game>`),
    )
    expect(parsed.entries[0]?.crc32).toBe('00001a2b')
  })

  it('trata um único <game> igual a vários', () => {
    const many = parseLogiqxDat(
      dat(`
      <game name="A"><rom name="a.bin" size="1" crc="00000001"/></game>
      <game name="B"><rom name="b.bin" size="1" crc="00000002"/></game>`),
    )
    expect(many.entries.map((entry) => entry.gameName)).toEqual(['A', 'B'])
    expect(parseLogiqxDat(ONE_GAME).entries).toHaveLength(1)
  })

  it('gera uma entrada por rom quando o jogo tem várias', () => {
    const parsed = parseLogiqxDat(
      dat(`
      <game name="Jogo em Dois Discos">
        <rom name="disco1.bin" size="10" crc="00000001"/>
        <rom name="disco2.bin" size="20" crc="00000002"/>
      </game>`),
    )
    expect(parsed.entries).toHaveLength(2)
    expect(parsed.entries.every((entry) => entry.gameName === 'Jogo em Dois Discos')).toBe(true)
  })

  it('descarta entradas sem hash nenhum, que não são indexáveis', () => {
    const parsed = parseLogiqxDat(
      dat(`
      <game name="Nodump"><rom name="nodump.bin" size="0" status="nodump"/></game>
      <game name="Bom"><rom name="bom.bin" size="4" crc="deadbeef"/></game>`),
    )
    expect(parsed.entries.map((entry) => entry.gameName)).toEqual(['Bom'])
  })

  it('preserva caracteres escapados no nome do jogo', () => {
    const parsed = parseLogiqxDat(
      dat(`<game name="Tom &amp; Jerry"><rom name="tj.bin" size="1" crc="00000003"/></game>`),
    )
    expect(parsed.entries[0]?.gameName).toBe('Tom & Jerry')
  })

  it('rejeita XML que não é um DAT', () => {
    expect(() => parseLogiqxDat('<outracoisa/>')).toThrow(DatParseError)
  })

  it('rejeita DAT sem nome no cabeçalho', () => {
    expect(() => parseLogiqxDat('<datafile><header></header></datafile>')).toThrow(/header.*name/i)
  })
})
