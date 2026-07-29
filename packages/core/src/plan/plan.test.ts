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

describe('planRenames — template aplicado sobre identificações já feitas', () => {
  const identified = identification('qualquer.nes', 'Alfa (USA).nes', {
    matches: [
      {
        gameName: 'Alfa (USA)',
        romName: 'Alfa (USA).nes',
        size: 1,
        year: '1988',
        crc32: 'deadbeef',
        md5: null,
        sha1: null,
        datSource: 'DAT',
      },
    ],
  })

  it('recalcula o destino sem precisar de um novo scan', () => {
    const plan = planRenames([identified], { template: '{title}[ ({region})].{ext}' })
    expect(plan.operations[0]?.to).toBe(join(DIR, 'Alfa (USA).nes'))
  })

  it('aplica template com subpastas usando dados que já estavam no match', () => {
    const plan = planRenames([identified], { template: '{region}/{year}/{title}.{ext}' })
    expect(plan.operations[0]?.to).toBe(join(DIR, 'USA', '1988', 'Alfa.nes'))
  })

  it('preserva o método de identificação — o template não muda como o arquivo foi achado', () => {
    const plan = planRenames([identified], { template: '{title}.{ext}' })
    expect(plan.operations[0]?.identification.method).toBe('hash')
  })

  it('sem template, mantém o nome canônico do DAT', () => {
    expect(planRenames([identified]).operations[0]?.to).toBe(join(DIR, 'Alfa (USA).nes'))
  })
})

describe('planRenames — subpastas contam a partir da raiz da biblioteca', () => {
  function inSubfolder(subfolder: string, fileName: string, proposed: string): Identification {
    return {
      ...identification(fileName, proposed),
      filePath: join(DIR, subfolder, fileName),
    }
  }

  it('resolve o template a partir da raiz, não da pasta onde o arquivo está', () => {
    // O arquivo já está em USA/; sem a raiz, o destino viraria USA/USA/.
    const plan = planRenames([inSubfolder('USA', 'Jogo.nes', 'USA/Jogo (USA).nes')], {
      rootDirectory: DIR,
    })

    expect(plan.operations[0]?.to).toBe(join(DIR, 'USA', 'Jogo (USA).nes'))
  })

  it('é idempotente: rodar de novo sobre o resultado não move mais nada', () => {
    // Este é o bug do aninhamento infinito — a segunda passada tem que ser um no-op.
    const alreadyOrganized = inSubfolder('USA', 'Jogo (USA).nes', 'USA/Jogo (USA).nes')
    const plan = planRenames([alreadyOrganized], { rootDirectory: DIR })

    expect(plan.operations).toEqual([])
    expect(plan.skipped[0]?.reason).toBe('already-named')
  })

  it('não empilha nem depois de várias execuções', () => {
    let current = inSubfolder('USA', 'bagunca.nes', 'USA/Jogo (USA).nes')

    for (let pass = 0; pass < 3; pass += 1) {
      const plan = planRenames([current], { rootDirectory: DIR })
      const destination = plan.operations[0]?.to ?? current.filePath
      expect(destination).toBe(join(DIR, 'USA', 'Jogo (USA).nes'))
      current = { ...current, filePath: destination, fileName: 'Jogo (USA).nes' }
    }
  })

  it('template sem barra deixa o arquivo na subpasta em que está', () => {
    // Quem só quer renomear não deve ver os arquivos migrarem para a raiz.
    const plan = planRenames([inSubfolder('Sub', 'x.nes', 'Jogo (USA).nes')], {
      rootDirectory: DIR,
    })

    expect(plan.operations[0]?.to).toBe(join(DIR, 'Sub', 'Jogo (USA).nes'))
  })

  it('sem raiz informada, mantém o comportamento relativo ao próprio arquivo', () => {
    const plan = planRenames([inSubfolder('Sub', 'x.nes', 'Jogo.nes')])
    expect(plan.operations[0]?.to).toBe(join(DIR, 'Sub', 'Jogo.nes'))
  })

  it('move para a raiz um arquivo que estava na subpasta errada', () => {
    const plan = planRenames([inSubfolder('Japan', 'x.nes', 'USA/Jogo (USA).nes')], {
      rootDirectory: DIR,
    })

    expect(plan.operations[0]?.to).toBe(join(DIR, 'USA', 'Jogo (USA).nes'))
  })
})

describe('planRenames — quarentena', () => {
  const unknown = identification('dump_9999.nes', null, { method: 'unidentified' })

  it('move o não identificado para a pasta de quarentena', () => {
    const plan = planRenames([unknown], {
      rootDirectory: DIR,
      quarantineDirectory: '_nao-identificados',
    })

    expect(plan.operations[0]?.to).toBe(join(DIR, '_nao-identificados', 'dump_9999.nes'))
  })

  it('preserva o nome — o arquivo muda de lugar, não de identidade', () => {
    const plan = planRenames([unknown], {
      rootDirectory: DIR,
      quarantineDirectory: 'quarentena',
    })

    expect(plan.operations[0]?.to.endsWith('dump_9999.nes')).toBe(true)
  })

  it('sem quarentena configurada, apenas fica de fora do plano', () => {
    const plan = planRenames([unknown], { rootDirectory: DIR })
    expect(plan.operations).toEqual([])
    expect(plan.skipped[0]?.reason).toBe('no-proposal')
  })

  it('não mexe em quem já está na quarentena', () => {
    const alreadyThere = {
      ...unknown,
      filePath: join(DIR, 'quarentena', 'dump_9999.nes'),
    }

    const plan = planRenames([alreadyThere], {
      rootDirectory: DIR,
      quarantineDirectory: 'quarentena',
    })

    expect(plan.operations).toEqual([])
    expect(plan.skipped[0]?.reason).toBe('already-named')
  })

  it('não põe em quarentena o que foi identificado', () => {
    const plan = planRenames([identification('x.nes', 'Jogo (USA).nes')], {
      rootDirectory: DIR,
      quarantineDirectory: 'quarentena',
    })

    expect(plan.operations[0]?.to).toBe(join(DIR, 'Jogo (USA).nes'))
  })

  it('não move um zip por causa de uma entrada não identificada dentro dele', () => {
    // Mover o container levaria junto as ROMs que porventura foram reconhecidas.
    const insideZip = { ...unknown, archiveEntry: 'dump.nes' }

    const plan = planRenames([insideZip], {
      rootDirectory: DIR,
      quarantineDirectory: 'quarentena',
    })

    expect(plan.operations).toEqual([])
    expect(plan.skipped[0]?.reason).toBe('no-proposal')
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
