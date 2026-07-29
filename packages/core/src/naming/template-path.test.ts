import { describe, expect, it } from 'vitest'
import { buildRelativePath } from './template.ts'

const TOKENS = {
  title: 'Super Test Bros.',
  region: 'USA',
  year: '1991',
  system: 'Super Nintendo Entertainment System',
  letter: 'S',
  ext: 'sfc',
}

describe('buildRelativePath', () => {
  it('monta subpastas a partir das barras do template', () => {
    expect(buildRelativePath('{region}/{year}/{title}.{ext}', TOKENS)).toBe(
      'USA/1991/Super Test Bros..sfc',
    )
  })

  it('sanitiza cada segmento sem destruir a barra separadora', () => {
    // Se a sanitização rodasse no caminho inteiro, a `/` viraria `_` e tudo colapsaria
    // num nome de arquivo só.
    expect(buildRelativePath('{region}/{title}.{ext}', { ...TOKENS, title: 'Jogo: Parte 2' })).toBe(
      'USA/Jogo_ Parte 2.sfc',
    )
  })

  it('descarta segmento que ficou vazio em vez de criar uma pasta "_"', () => {
    expect(buildRelativePath('{region}/{title}.{ext}', { ...TOKENS, region: undefined })).toBe(
      'Super Test Bros..sfc',
    )
  })

  it('combina grupos opcionais com subpastas', () => {
    const template = '{system}/{letter}/{title}[ ({region})].{ext}'

    expect(buildRelativePath(template, TOKENS)).toBe(
      'Super Nintendo Entertainment System/S/Super Test Bros. (USA).sfc',
    )
    expect(buildRelativePath(template, { ...TOKENS, region: undefined })).toBe(
      'Super Nintendo Entertainment System/S/Super Test Bros..sfc',
    )
  })

  it('ignora barras duplicadas e espaços em volta dos segmentos', () => {
    expect(buildRelativePath('{region} / / {title}.{ext}', TOKENS)).toBe('USA/Super Test Bros..sfc')
  })

  it('não deixa o template escapar da pasta da biblioteca', () => {
    // `..` como segmento é sanitizado para um nome comum, não vira navegação de diretório.
    const result = buildRelativePath('../{title}.{ext}', TOKENS)
    expect(result.startsWith('..')).toBe(false)
  })

  it('sem barras, se comporta como um nome de arquivo simples', () => {
    expect(buildRelativePath('{title}.{ext}', TOKENS)).toBe('Super Test Bros..sfc')
  })
})
