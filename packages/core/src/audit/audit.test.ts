import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditCollection, regionsIn } from './audit.ts'
import { auditToCsv, auditToMarkdown } from './export.ts'
import { DatIndex } from '../dat/index-db.ts'
import type { Identification } from '../identify/identify.ts'
import type { SystemRulePack } from '../systems/types.ts'

const NES: SystemRulePack = {
  id: 'nes',
  name: 'Nintendo Entertainment System',
  manufacturer: 'Nintendo',
  extensions: ['nes'],
  defaultTemplate: '{title}.{ext}',
}

let index: DatIndex

beforeEach(() => {
  index = new DatIndex()
  index.importDat({
    name: 'No-Intro NES',
    entries: [
      { gameName: 'Alfa (USA)', romName: 'Alfa (USA).nes', size: 1, crc32: '00000001' },
      { gameName: 'Beta (Japan)', romName: 'Beta (Japan).nes', size: 1, crc32: '00000002' },
      { gameName: 'Gama (Europe)', romName: 'Gama (Europe).nes', size: 1, crc32: '00000003' },
      { gameName: 'Delta (USA) (Proto)', romName: 'Delta (USA) (Proto).nes', size: 1, crc32: '04' },
    ],
  })
})

afterEach(() => {
  index.close()
})

/** Identificação que casou com um jogo do DAT. */
function have(gameName: string, filePath: string, extra: Partial<Identification> = {}) {
  return {
    filePath,
    fileName: filePath.split('/').pop() as string,
    system: NES,
    method: 'hash' as const,
    header: { offset: 0, method: 'none' as const },
    byteOrder: { variantId: null, swapSize: 1 as const },
    matches: [
      {
        gameName,
        romName: `${gameName}.nes`,
        size: 1,
        year: null,
        crc32: null,
        md5: null,
        sha1: null,
        datSource: 'No-Intro NES',
      },
    ],
    ambiguous: false,
    parsedName: {
      title: gameName,
      regions: [],
      languages: [],
      flags: [],
      badDump: false,
      convention: 'no-intro' as const,
    },
    proposedName: `${gameName}.nes`,
    ...extra,
  } as Identification
}

function unknown(filePath: string): Identification {
  return {
    ...have('x', filePath),
    matches: [],
    method: 'unidentified',
    proposedName: null,
  }
}

describe('auditCollection', () => {
  it('separa o que tem do que falta', () => {
    const report = auditCollection([have('Alfa (USA)', '/roms/a.nes')], index)

    expect(report.total).toBe(3)
    expect(report.have).toBe(1)
    expect(report.missing).toBe(2)
    expect(report.completion).toBeCloseTo(33.3, 0)
  })

  it('exclui protótipos e betas por padrão', () => {
    // Quem pergunta "o que falta" raramente considera faltando um beta nunca lançado.
    expect(auditCollection([], index).total).toBe(3)
    expect(auditCollection([], index, { includeUnreleased: true }).total).toBe(4)
  })

  it('filtra por região, que é o que permite auditar um set 1G1R', () => {
    const report = auditCollection([], index, { regions: ['USA', 'Europe'] })

    expect(report.games.map((game) => game.gameName)).toEqual(['Alfa (USA)', 'Gama (Europe)'])
    expect(report.missing).toBe(2)
  })

  it('aponta onde está cada jogo presente', () => {
    const report = auditCollection([have('Alfa (USA)', '/roms/nome_bagunçado.nes')], index)
    const alfa = report.games.find((game) => game.gameName === 'Alfa (USA)')

    expect(alfa?.status).toBe('have')
    expect(alfa?.filePath).toBe('/roms/nome_bagunçado.nes')
  })

  it('detecta duplicados', () => {
    const report = auditCollection(
      [have('Alfa (USA)', '/roms/copia1.nes'), have('Alfa (USA)', '/roms/copia2.nes')],
      index,
    )

    expect(report.duplicates).toHaveLength(1)
    expect(report.duplicates[0]?.filePaths).toEqual(['/roms/copia1.nes', '/roms/copia2.nes'])
    // Duplicado não conta duas vezes como presente.
    expect(report.have).toBe(1)
  })

  it('lista arquivos que nenhum DAT reivindica', () => {
    const report = auditCollection([unknown('/roms/hack_traduzido.nes')], index)

    expect(report.unrecognized).toEqual([
      {
        filePath: '/roms/hack_traduzido.nes',
        fileName: 'hack_traduzido.nes',
        identifiedBy: 'unidentified',
      },
    ])
  })

  it('conta um jogo uma vez só, mesmo com várias ROMs', () => {
    index.importDat({
      name: 'Multi',
      entries: [
        { gameName: 'Dois Discos', romName: 'd1.bin', size: 1, crc32: '0a' },
        { gameName: 'Dois Discos', romName: 'd2.bin', size: 1, crc32: '0b' },
      ],
    })

    const report = auditCollection([], index, { datSource: 'Multi' })
    expect(report.total).toBe(1)
  })

  it('limita a um DAT quando pedido', () => {
    index.importDat({
      name: 'Outro DAT',
      entries: [{ gameName: 'Ômega (USA)', romName: 'Ômega (USA).nes', size: 1, crc32: '09' }],
    })

    expect(auditCollection([], index, { datSource: 'Outro DAT' }).total).toBe(1)
    expect(auditCollection([], index).total).toBe(4)
  })

  it('não perde jogos de DAT que não declara região', () => {
    index.importDat({
      name: 'Sem Região',
      entries: [{ gameName: 'Anônimo', romName: 'Anônimo.nes', size: 1, crc32: '0c' }],
    })

    const report = auditCollection([], index, { datSource: 'Sem Região', regions: ['USA'] })
    expect(report.total).toBe(1)
  })
})

describe('regionsIn', () => {
  it('lista as regiões presentes, para montar o filtro', () => {
    expect(regionsIn(auditCollection([], index))).toEqual(['Europe', 'Japan', 'USA'])
  })
})

describe('exportação', () => {
  it('gera CSV com uma linha por jogo', () => {
    const csv = auditToCsv(auditCollection([have('Alfa (USA)', '/roms/a.nes')], index))
    const lines = csv.split('\n')

    expect(lines[0]).toBe('status,game,regions,languages,dat,path')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('have,Alfa (USA)')
  })

  it('escapa vírgula e aspas do nome do jogo', () => {
    index.importDat({
      name: 'Vírgulas',
      entries: [{ gameName: 'Jogo, O "Melhor"', romName: 'x.nes', size: 1, crc32: '0d' }],
    })

    const csv = auditToCsv(auditCollection([], index, { datSource: 'Vírgulas' }))
    expect(csv).toContain('"Jogo, O ""Melhor"""')
  })

  it('gera Markdown com o resumo e a lista do que falta', () => {
    const markdown = auditToMarkdown(auditCollection([have('Alfa (USA)', '/roms/a.nes')], index))

    expect(markdown).toContain('Completude: **33.3%**')
    expect(markdown).toContain('## Faltando (2)')
    expect(markdown).toContain('- Beta (Japan)')
    expect(markdown).not.toContain('- Alfa (USA)')
  })
})
