import { describe, expect, it } from 'vitest'
import { parseClrMameProDat } from './clrmamepro.ts'
import { detectDatFormat, parseDat } from './parse-dat.ts'
import { DatParseError } from './logiqx.ts'

/** Recorte fiel do formato que o libretro-database publica. */
const SAMPLE = `clrmamepro (
	name "Nintendo - Game Boy"
	description "Nintendo - Game Boy"
	version "2026.05.02"
	homepage "http://github.com/robloach/libretro-dats"
)

game (
	name "10-Pin Bowling (USA) (Proto)"
	region "USA"
	rom ( name "10-Pin Bowling (USA) (Proto).gb" size 131072 crc 9A024415 md5 7616285DDCB0A1834770CACD20C2B2FE sha1 952D154DD2C6189EF4B786AE37BD7887C8CA9037 )
)
game (
	name "14 Juillet (World) (Fr)"
	rom ( name "14 Juillet (World) (Fr) (Aftermarket) (Unl).gb" size 1048576 crc 7B66BEE4 )
)
`

describe('parseClrMameProDat', () => {
  it('lê o cabeçalho', () => {
    const parsed = parseClrMameProDat(SAMPLE)
    expect(parsed.name).toBe('Nintendo - Game Boy')
    expect(parsed.version).toBe('2026.05.02')
  })

  it('lê as entradas e normaliza os hashes para minúsculo', () => {
    const [first] = parseClrMameProDat(SAMPLE).entries
    expect(first).toEqual({
      gameName: '10-Pin Bowling (USA) (Proto)',
      romName: '10-Pin Bowling (USA) (Proto).gb',
      size: 131072,
      crc32: '9a024415',
      md5: '7616285ddcb0a1834770cacd20c2b2fe',
      sha1: '952d154dd2c6189ef4b786ae37bd7887c8ca9037',
    })
  })

  it('aceita entrada com apenas parte dos hashes', () => {
    const second = parseClrMameProDat(SAMPLE).entries[1]
    expect(second?.crc32).toBe('7b66bee4')
    expect(second?.sha1).toBeUndefined()
  })

  it('lê nome com parênteses, que são também a sintaxe do formato', () => {
    const parsed = parseClrMameProDat(
      `clrmamepro ( name "X" )
       game ( name "Jogo (USA) (Rev A)" rom ( name "a.gb" size 1 crc 00000001 ) )`,
    )
    expect(parsed.entries[0]?.gameName).toBe('Jogo (USA) (Rev A)')
  })

  it('lê nome com aspas escapadas', () => {
    const parsed = parseClrMameProDat(
      `clrmamepro ( name "X" )
       game ( name "O \\"Melhor\\" Jogo" rom ( name "a.gb" size 1 crc 00000001 ) )`,
    )
    expect(parsed.entries[0]?.gameName).toBe('O "Melhor" Jogo')
  })

  it('gera uma entrada por rom quando o jogo tem várias', () => {
    const parsed = parseClrMameProDat(
      `clrmamepro ( name "X" )
       game ( name "Dois Discos"
         rom ( name "d1.bin" size 10 crc 00000001 )
         rom ( name "d2.bin" size 20 crc 00000002 ) )`,
    )
    expect(parsed.entries).toHaveLength(2)
  })

  it('descarta entradas sem hash nenhum', () => {
    const parsed = parseClrMameProDat(
      `clrmamepro ( name "X" )
       game ( name "Nodump" rom ( name "n.gb" size 0 flags nodump ) )`,
    )
    expect(parsed.entries).toEqual([])
  })

  it('ignora comentários de linha', () => {
    const parsed = parseClrMameProDat(
      `# comentário no topo
       clrmamepro ( name "X" )
       game ( name "A" rom ( name "a.gb" size 1 crc 00000001 ) )`,
    )
    expect(parsed.entries).toHaveLength(1)
  })

  it('rejeita bloco sem fechamento', () => {
    expect(() => parseClrMameProDat('clrmamepro ( name "X"')).toThrow(DatParseError)
  })

  it('rejeita DAT sem nome no cabeçalho', () => {
    expect(() => parseClrMameProDat('clrmamepro ( version "1" )')).toThrow(/name/i)
  })
})

describe('parseDat — detecção de dialeto', () => {
  it('reconhece clrmamepro e Logiqx pelo início do conteúdo', () => {
    expect(detectDatFormat(SAMPLE)).toBe('clrmamepro')
    expect(detectDatFormat('<?xml version="1.0"?><datafile/>')).toBe('logiqx')
    expect(detectDatFormat('\n  <datafile/>')).toBe('logiqx')
  })

  it('parseia os dois formatos pela mesma porta', () => {
    expect(parseDat(SAMPLE).name).toBe('Nintendo - Game Boy')
    expect(
      parseDat('<?xml version="1.0"?><datafile><header><name>XML</name></header></datafile>').name,
    ).toBe('XML')
  })
})
