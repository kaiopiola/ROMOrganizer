import type { SystemRulePack } from './types.ts'

export class RulePackError extends Error {
  readonly packId: string

  constructor(packId: string, message: string) {
    super(`[${packId}] ${message}`)
    this.name = 'RulePackError'
    this.packId = packId
  }
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HEX_PATTERN = /^([0-9a-f]{2})+$/

function assert(condition: boolean, packId: string, message: string): asserts condition {
  if (!condition) throw new RulePackError(packId, message)
}

/**
 * Valida um rule pack vindo de JSON. Roda tanto no teste do repositório (para barrar
 * PR quebrado) quanto em runtime, já que packs podem ser buscados remotamente.
 */
export function validateRulePack(input: unknown): SystemRulePack {
  if (typeof input !== 'object' || input === null) {
    throw new RulePackError('?', 'rule pack precisa ser um objeto')
  }

  const pack = input as Partial<SystemRulePack>
  const id = typeof pack.id === 'string' ? pack.id : '?'

  assert(ID_PATTERN.test(id), id, 'id precisa ser kebab-case (ex.: "mega-drive")')
  assert(typeof pack.name === 'string' && pack.name.length > 0, id, 'name é obrigatório')
  assert(
    typeof pack.manufacturer === 'string' && pack.manufacturer.length > 0,
    id,
    'manufacturer é obrigatório',
  )
  assert(
    typeof pack.defaultTemplate === 'string' && pack.defaultTemplate.length > 0,
    id,
    'defaultTemplate é obrigatório',
  )
  assert(
    Array.isArray(pack.extensions) && pack.extensions.length > 0,
    id,
    'extensions precisa ter ao menos uma entrada',
  )

  for (const ext of pack.extensions) {
    assert(
      typeof ext === 'string' && /^[a-z0-9]+$/.test(ext),
      id,
      `extensão inválida: ${String(ext)} (minúscula, sem ponto)`,
    )
  }
  assert(
    new Set(pack.extensions).size === pack.extensions.length,
    id,
    'extensions tem entradas duplicadas',
  )

  if (pack.header !== undefined) {
    const { size, magic, moduloBase } = pack.header
    assert(Number.isInteger(size) && size > 0, id, 'header.size precisa ser inteiro positivo')
    assert(
      magic !== undefined || moduloBase !== undefined,
      id,
      'header precisa de magic ou moduloBase, senão não há como detectá-lo',
    )
    if (magic !== undefined) {
      assert(HEX_PATTERN.test(magic), id, `header.magic não é hex par: ${magic}`)
      assert(
        magic.length / 2 <= size,
        id,
        'header.magic é maior que header.size — a assinatura não caberia no header',
      )
    }
    if (moduloBase !== undefined) {
      assert(
        Number.isInteger(moduloBase) && moduloBase > size,
        id,
        'header.moduloBase precisa ser inteiro maior que header.size',
      )
    }
  }

  if (pack.byteOrder !== undefined) {
    const { canonicalMagic, variants } = pack.byteOrder
    assert(
      typeof canonicalMagic === 'string' && HEX_PATTERN.test(canonicalMagic),
      id,
      'byteOrder.canonicalMagic não é hex par',
    )
    assert(Array.isArray(variants) && variants.length > 0, id, 'byteOrder.variants está vazio')
    for (const variant of variants) {
      assert(
        typeof variant.id === 'string' && ID_PATTERN.test(variant.id),
        id,
        `variante com id inválido: ${String(variant.id)}`,
      )
      assert(
        typeof variant.magic === 'string' && HEX_PATTERN.test(variant.magic),
        id,
        `variante ${variant.id}: magic não é hex par`,
      )
      assert(
        variant.magic !== canonicalMagic,
        id,
        `variante ${variant.id}: magic igual ao canônico — seria ambíguo`,
      )
      assert(
        variant.swapSize === 2 || variant.swapSize === 4,
        id,
        `variante ${variant.id}: swapSize precisa ser 2 ou 4`,
      )
    }
  }

  return pack as SystemRulePack
}
