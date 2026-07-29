import { describe, expect, it } from 'vitest'
import { buildFileName, renderTemplate, sanitizeFileName, TemplateError } from './template.ts'

const DEFAULT = '{title}[ ({region})][ ({revision})].{ext}'

describe('renderTemplate', () => {
  it('substitui tokens simples', () => {
    expect(renderTemplate('{title}.{ext}', { title: 'Jogo', ext: 'sfc' })).toBe('Jogo.sfc')
  })

  it('mantém o grupo opcional quando todos os tokens dentro têm valor', () => {
    expect(renderTemplate(DEFAULT, { title: 'Jogo', region: 'USA', ext: 'sfc' })).toBe(
      'Jogo (USA).sfc',
    )
  })

  it('remove o grupo inteiro quando falta valor, sem deixar parêntese órfão', () => {
    expect(renderTemplate(DEFAULT, { title: 'Jogo', ext: 'sfc' })).toBe('Jogo.sfc')
  })

  it('avalia cada grupo opcional de forma independente', () => {
    expect(renderTemplate(DEFAULT, { title: 'Jogo', revision: 'Rev A', ext: 'sfc' })).toBe(
      'Jogo (Rev A).sfc',
    )
  })

  it('trata string vazia como ausente', () => {
    expect(renderTemplate(DEFAULT, { title: 'Jogo', region: '', ext: 'sfc' })).toBe('Jogo.sfc')
  })

  it('deixa token desconhecido virar vazio em vez de aparecer cru no nome', () => {
    expect(renderTemplate('{title}-{inexistente}.{ext}', { title: 'A', ext: 'gb' })).toBe('A-.gb')
  })

  it('rejeita grupo opcional sem fechamento', () => {
    expect(() => renderTemplate('{title}[ ({region}).{ext}', { title: 'A' })).toThrow(TemplateError)
  })
})

describe('sanitizeFileName', () => {
  it('troca caracteres proibidos no Windows', () => {
    expect(sanitizeFileName('Jogo: O Retorno?')).toBe('Jogo_ O Retorno_')
    expect(sanitizeFileName('A/B\\C')).toBe('A_B_C')
  })

  it('preserva espaços, parênteses, hífen e acento — que são legítimos', () => {
    expect(sanitizeFileName('Círculo Mágico - Edição Especial (Brazil)')).toBe(
      'Círculo Mágico - Edição Especial (Brazil)',
    )
  })

  it('remove ponto e espaço no fim, que o Windows rejeita', () => {
    expect(sanitizeFileName('Jogo...')).toBe('Jogo')
    expect(sanitizeFileName('Jogo   ')).toBe('Jogo')
  })

  it('escapa nomes de dispositivo reservados', () => {
    expect(sanitizeFileName('CON.nes')).toBe('_CON.nes')
    expect(sanitizeFileName('com1.sfc')).toBe('_com1.sfc')
    expect(sanitizeFileName('Console.nes')).toBe('Console.nes')
  })

  it('remove caracteres de controle', () => {
    expect(sanitizeFileName('Jogo\u0007X')).toBe('JogoX')
  })

  it('nunca devolve string vazia', () => {
    expect(sanitizeFileName('///')).toBe('___')
    expect(sanitizeFileName('   ')).toBe('_')
  })
})

describe('buildFileName', () => {
  it('renderiza e sanitiza numa passada só', () => {
    expect(buildFileName(DEFAULT, { title: 'Jogo: Parte 2', region: 'USA', ext: 'sfc' })).toBe(
      'Jogo_ Parte 2 (USA).sfc',
    )
  })
})
