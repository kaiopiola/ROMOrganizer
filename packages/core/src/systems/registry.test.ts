import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadRulePacksFrom, SystemRegistry } from './registry.ts'
import { RulePackError, validateRulePack } from './validate.ts'

const RULE_PACKS_DIR = fileURLToPath(new URL('../../../../data/systems', import.meta.url))

function pack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-system',
    name: 'Test System',
    manufacturer: 'Test Corp',
    extensions: ['tst'],
    defaultTemplate: '{title}.{ext}',
    ...overrides,
  }
}

describe('rule packs versionados no repositório', () => {
  it('todos passam na validação e o id bate com o nome do arquivo', async () => {
    const packs = await loadRulePacksFrom(RULE_PACKS_DIR)
    expect(packs.length).toBeGreaterThan(0)
  })

  it('carregam num registry sem id duplicado', async () => {
    const registry = new SystemRegistry(await loadRulePacksFrom(RULE_PACKS_DIR))
    expect(registry.size).toBe(registry.all().length)
  })

  it('expõe o header do NES e do SNES, que são a causa clássica de CRC divergente', async () => {
    const registry = new SystemRegistry(await loadRulePacksFrom(RULE_PACKS_DIR))
    expect(registry.get('nes')?.header).toEqual({ size: 16, magic: '4e45531a' })
    expect(registry.get('snes')?.header).toEqual({ size: 512, moduloBase: 1024 })
  })

  it('trata extensão compartilhada como ambígua em vez de escolher um sistema', async () => {
    const registry = new SystemRegistry(await loadRulePacksFrom(RULE_PACKS_DIR))
    expect(registry.findByExtension('.SFC').map((p) => p.id)).toEqual(['snes'])
    expect(registry.findByExtension('nope')).toEqual([])
  })
})

describe('validateRulePack', () => {
  it('aceita um pack mínimo', () => {
    expect(validateRulePack(pack()).id).toBe('test-system')
  })

  it.each([
    ['id não kebab-case', { id: 'Test_System' }],
    ['sem extensões', { extensions: [] }],
    ['extensão com ponto', { extensions: ['.tst'] }],
    ['extensão duplicada', { extensions: ['tst', 'tst'] }],
    ['header sem forma de detecção', { header: { size: 16 } }],
    ['header com magic maior que o próprio header', { header: { size: 2, magic: '4e45531a' } }],
    ['header com moduloBase menor que o header', { header: { size: 512, moduloBase: 256 } }],
    ['magic com número ímpar de dígitos hex', { header: { size: 16, magic: 'abc' } }],
  ])('rejeita: %s', (_label, overrides) => {
    expect(() => validateRulePack(pack(overrides))).toThrow(RulePackError)
  })

  it('rejeita variante de byte order que colide com a ordenação canônica', () => {
    const invalid = pack({
      byteOrder: {
        canonicalMagic: '80371240',
        variants: [{ id: 'v64', magic: '80371240', swapSize: 2 }],
      },
    })
    expect(() => validateRulePack(invalid)).toThrow(/ambíguo/)
  })
})
