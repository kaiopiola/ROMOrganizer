import { describe, expect, it } from 'vitest'
import { parseRomName } from './parse-name.ts'

describe('parseRomName — convenção No-Intro', () => {
  it('separa título e região', () => {
    const parsed = parseRomName('Super Test Bros. (USA).sfc')
    expect(parsed.title).toBe('Super Test Bros.')
    expect(parsed.regions).toEqual(['USA'])
    expect(parsed.convention).toBe('no-intro')
  })

  it('lê múltiplas regiões, tanto em grupos separados quanto numa lista', () => {
    expect(parseRomName('Jogo (USA) (Europe).sfc').regions).toEqual(['USA', 'Europe'])
    expect(parseRomName('Jogo (USA, Europe).sfc').regions).toEqual(['USA', 'Europe'])
  })

  it('lê idiomas e revisão', () => {
    const parsed = parseRomName('Jogo (Europe) (En,Fr,De) (Rev A).sfc')
    expect(parsed.languages).toEqual(['en', 'fr', 'de'])
    expect(parsed.revision).toBe('Rev A')
  })

  it('reconhece versão no formato v1.1', () => {
    expect(parseRomName('Jogo (USA) (v1.1).gba').revision).toBe('v1.1')
  })

  it('captura marcadores de status, inclusive numerados', () => {
    expect(parseRomName('Jogo (Japan) (Beta).sfc').flags).toEqual(['Beta'])
    expect(parseRomName('Jogo (Japan) (Beta 2).sfc').flags).toEqual(['Beta 2'])
    expect(parseRomName('Jogo (Unl).nes').flags).toEqual(['Unl'])
  })

  it('marca bad dump', () => {
    expect(parseRomName('Jogo (USA) [b].sfc').badDump).toBe(true)
    expect(parseRomName('Jogo (USA) [b2].sfc').badDump).toBe(true)
    expect(parseRomName('Jogo (USA).sfc').badDump).toBe(false)
  })

  it('não confunde [!] com bad dump', () => {
    expect(parseRomName('Jogo (U) [!].nes').badDump).toBe(false)
  })
})

describe('parseRomName — convenção GoodTools', () => {
  it('expande os códigos curtos de região', () => {
    expect(parseRomName('Jogo (U) [!].nes').regions).toEqual(['USA'])
    expect(parseRomName('Jogo (J).nes').regions).toEqual(['Japan'])
    expect(parseRomName('Jogo (UE).nes').regions).toEqual(['USA', 'Europe'])
  })

  it('identifica a convenção', () => {
    expect(parseRomName('Jogo (U) [!].nes').convention).toBe('goodtools')
  })
})

describe('parseRomName — casos que não devem virar palpite', () => {
  it('marca como desconhecida a convenção quando não há região', () => {
    const parsed = parseRomName('rom_qualquer_01.bin')
    expect(parsed.convention).toBe('unknown')
    expect(parsed.regions).toEqual([])
    expect(parsed.title).toBe('rom_qualquer_01')
  })

  it('ignora grupos que não reconhece, sem sujar o título', () => {
    const parsed = parseRomName('Jogo (USA) (Xpto Qualquer).sfc')
    expect(parsed.title).toBe('Jogo')
    expect(parsed.flags).toEqual([])
  })

  it('não perde o título de arquivo sem extensão', () => {
    expect(parseRomName('Jogo Sem Extensao (USA)').title).toBe('Jogo Sem Extensao')
  })

  it('preserva ponto inicial de nome oculto em vez de tratá-lo como extensão', () => {
    expect(parseRomName('.oculto').title).toBe('.oculto')
  })

  it('não duplica região repetida', () => {
    expect(parseRomName('Jogo (USA) (USA).sfc').regions).toEqual(['USA'])
  })
})
