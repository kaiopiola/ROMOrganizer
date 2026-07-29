import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isCaseOnlyRename, planRenames } from './plan.ts'
import type { Identification, IdentificationMethod } from '../identify/identify.ts'
import type { SystemRulePack } from '../systems/types.ts'

const NES: SystemRulePack = {
  id: 'nes',
  name: 'Nintendo Entertainment System',
  manufacturer: 'Nintendo',
  extensions: ['nes'],
  defaultTemplate: '{title}.{ext}',
}

const DIR = '/roms/nes'

function identification(
  fileName: string,
  proposedName: string | null,
  overrides: Partial<Identification> = {},
): Identification {
  return {
    filePath: join(DIR, fileName),
    fileName,
    system: NES,
    method: (overrides.method ?? 'hash') as IdentificationMethod,
    header: { offset: 0, method: 'none' },
    byteOrder: { variantId: null, swapSize: 1 },
    matches: [],
    ambiguous: false,
    parsedName: {
      title: fileName,
      regions: [],
      languages: [],
      flags: [],
      badDump: false,
      convention: 'no-intro',
    },
    proposedName,
    ...overrides,
  }
}

describe('planRenames', () => {
  it('planeja o rename de um arquivo identificado por hash', () => {
    const plan = planRenames([identification('bagunca.nes', 'Jogo (USA).nes')])

    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0]?.from).toBe(join(DIR, 'bagunca.nes'))
    expect(plan.operations[0]?.to).toBe(join(DIR, 'Jogo (USA).nes'))
    expect(plan.skipped).toEqual([])
  })

  it('mantém o arquivo na pasta em que ele já está', () => {
    const plan = planRenames([identification('x.nes', 'Y.nes')])
    expect(plan.operations[0]?.to.startsWith(DIR)).toBe(true)
  })

  it('pula o que já está com o nome certo', () => {
    const plan = planRenames([identification('Jogo (USA).nes', 'Jogo (USA).nes')])
    expect(plan.operations).toEqual([])
    expect(plan.skipped[0]?.reason).toBe('already-named')
  })

  it('pula o que não tem nome proposto', () => {
    const plan = planRenames([identification('dump_01.nes', null, { method: 'unidentified' })])
    expect(plan.skipped[0]?.reason).toBe('no-proposal')
  })

  it('não renomeia com base só no nome, a menos que peçam', () => {
    const porNome = [identification('Jogo (USA).nes', 'Jogo (Europe).nes', { method: 'filename' })]

    expect(planRenames(porNome).operations).toEqual([])
    expect(planRenames(porNome, { includeFilenameMatches: true }).operations).toHaveLength(1)
  })

  it('pula quando os DATs discordam, a menos que peçam', () => {
    const ambiguo = [
      identification('x.nes', 'Jogo A.nes', {
        ambiguous: true,
        matches: [
          {
            gameName: 'Jogo A',
            romName: 'a.nes',
            size: 1,
            year: null,
            crc32: null,
            md5: null,
            sha1: null,
            datSource: 'A',
          },
          {
            gameName: 'Jogo B',
            romName: 'b.nes',
            size: 1,
            year: null,
            crc32: null,
            md5: null,
            sha1: null,
            datSource: 'B',
          },
        ],
      }),
    ]

    const cauteloso = planRenames(ambiguo)
    expect(cauteloso.operations).toEqual([])
    expect(cauteloso.skipped[0]?.reason).toBe('ambiguous')
    expect(cauteloso.skipped[0]?.detail).toBe('Jogo A | Jogo B')

    expect(planRenames(ambiguo, { allowAmbiguous: true }).operations).toHaveLength(1)
  })
})

describe('planRenames — conflitos', () => {
  it('pula quando o destino já existe em disco', () => {
    const plan = planRenames([identification('x.nes', 'Jogo (USA).nes')], {
      existingPaths: [join(DIR, 'Jogo (USA).nes')],
    })

    expect(plan.operations).toEqual([])
    expect(plan.skipped[0]?.reason).toBe('collision')
    expect(plan.skipped[0]?.detail).toBe(join(DIR, 'Jogo (USA).nes'))
  })

  it('não trata como colisão o nome que o próprio lote vai liberar', () => {
    // a.nes -> b.nes e b.nes -> c.nes: o destino de a existe, mas b sai de lá no mesmo lote.
    const plan = planRenames([identification('a.nes', 'b.nes'), identification('b.nes', 'c.nes')], {
      existingPaths: [join(DIR, 'a.nes'), join(DIR, 'b.nes')],
    })

    expect(plan.operations).toHaveLength(2)
    expect(plan.skipped).toEqual([])
  })

  it('pula os dois lados quando dois arquivos disputam o mesmo destino', () => {
    const plan = planRenames([
      identification('copia1.nes', 'Jogo (USA).nes'),
      identification('copia2.nes', 'Jogo (USA).nes'),
    ])

    expect(plan.operations).toEqual([])
    expect(plan.skipped.map((entry) => entry.reason)).toEqual([
      'duplicate-target',
      'duplicate-target',
    ])
  })

  it('trata destinos que só diferem na caixa como o mesmo destino', () => {
    // Em macOS e Windows os dois nomes ocupam a mesma entrada de diretório.
    const plan = planRenames([
      identification('a.nes', 'Jogo (USA).nes'),
      identification('b.nes', 'jogo (usa).nes'),
    ])

    expect(plan.operations).toEqual([])
    expect(plan.skipped).toHaveLength(2)
  })

  it('detecta colisão ignorando a caixa do arquivo existente', () => {
    const plan = planRenames([identification('x.nes', 'Jogo (USA).nes')], {
      existingPaths: [join(DIR, 'JOGO (USA).NES')],
    })
    expect(plan.skipped[0]?.reason).toBe('collision')
  })
})

describe('isCaseOnlyRename', () => {
  it('reconhece mudança só de caixa', () => {
    expect(isCaseOnlyRename('/a/Mario.nes', '/a/mario.nes')).toBe(true)
    expect(isCaseOnlyRename('/a/Mario.nes', '/a/Mario.nes')).toBe(false)
    expect(isCaseOnlyRename('/a/Mario.nes', '/a/Luigi.nes')).toBe(false)
  })
})
