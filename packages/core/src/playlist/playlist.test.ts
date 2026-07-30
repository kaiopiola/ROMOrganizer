import { describe, expect, it } from 'vitest'
import { buildM3u, detectDiscGroups, m3uNameFor, parseDiscName } from './disc-groups.ts'
import { buildLpl, lplNameFor, serializeLpl } from './lpl.ts'
import type { Identification } from '../identify/identify.ts'
import type { SystemRulePack } from '../systems/types.ts'

const PS1: SystemRulePack = {
  id: 'psx',
  name: 'PlayStation',
  manufacturer: 'Sony',
  extensions: ['cue', 'bin'],
  libretroDat: 'Sony - PlayStation',
  defaultTemplate: '{title}.{ext}',
}

function identification(fileName: string, overrides: Partial<Identification> = {}): Identification {
  return {
    filePath: `/roms/${fileName}`,
    fileName,
    system: PS1,
    method: 'hash',
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
    proposedName: fileName,
    ...overrides,
  }
}

function matched(fileName: string, gameName: string, crc32 = 'abcd1234'): Identification {
  return identification(fileName, {
    matches: [
      {
        gameName,
        romName: fileName,
        size: 1,
        year: null,
        crc32,
        md5: null,
        sha1: null,
        datSource: 'Redump',
      },
    ],
    proposedName: `${gameName}.cue`,
  })
}

describe('parseDiscName', () => {
  it.each([
    ['Jogo (USA) (Disc 1).cue', 'Jogo (USA)', 1],
    ['Jogo (USA) (Disc 2).cue', 'Jogo (USA)', 2],
    ['Jogo (CD 3).cue', 'Jogo', 3],
    ['Jogo (Disk 4).cue', 'Jogo', 4],
    ['Jogo (disco 5).cue', 'Jogo', 5],
  ])('reconhece %s', (fileName, title, number) => {
    const parsed = parseDiscName(fileName)
    expect(parsed?.title).toBe(title)
    expect(parsed?.discNumber).toBe(number)
  })

  it('preserva o que vem depois do marcador', () => {
    expect(parseDiscName('Jogo (Disc 1) (Rev A).cue')?.suffix).toBe('(Rev A)')
  })

  it('devolve null para nome sem disco', () => {
    expect(parseDiscName('Jogo (USA).cue')).toBeNull()
  })
})

describe('detectDiscGroups', () => {
  it('agrupa discos do mesmo jogo, em ordem', () => {
    const groups = detectDiscGroups([
      identification('Jogo (USA) (Disc 2).cue'),
      identification('Jogo (USA) (Disc 1).cue'),
      identification('Jogo (USA) (Disc 3).cue'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBe('Jogo (USA)')
    expect(groups[0]?.discs.map((disc) => disc.number)).toEqual([1, 2, 3])
  })

  it('ignora jogo de disco único', () => {
    // Um .m3u apontando para um arquivo só não resolve nada e ainda polui a pasta.
    expect(detectDiscGroups([identification('Jogo (USA) (Disc 1).cue')])).toEqual([])
  })

  it('não mistura jogos diferentes nem revisões diferentes', () => {
    const groups = detectDiscGroups([
      identification('Alfa (Disc 1).cue'),
      identification('Alfa (Disc 2).cue'),
      identification('Beta (Disc 1).cue'),
      identification('Beta (Disc 2).cue'),
      identification('Alfa (Disc 1) (Rev A).cue'),
      identification('Alfa (Disc 2) (Rev A).cue'),
    ])

    expect(groups.map((group) => `${group.title} ${group.suffix}`.trim())).toEqual([
      'Alfa',
      'Alfa (Rev A)',
      'Beta',
    ])
  })

  it('usa o nome proposto, não o atual', () => {
    // A playlist tem que apontar para o resultado do rename, não para o estado de agora.
    const groups = detectDiscGroups([
      identification('bagunca_a.cue', { proposedName: 'Jogo (Disc 1).cue' }),
      identification('bagunca_b.cue', { proposedName: 'Jogo (Disc 2).cue' }),
    ])

    expect(groups[0]?.discs.map((disc) => disc.fileName)).toEqual([
      'Jogo (Disc 1).cue',
      'Jogo (Disc 2).cue',
    ])
  })

  it('gera o m3u com um caminho relativo por linha', () => {
    const [group] = detectDiscGroups([
      identification('Jogo (USA) (Disc 1).cue'),
      identification('Jogo (USA) (Disc 2).cue'),
    ])

    expect(m3uNameFor(group!)).toBe('Jogo (USA).m3u')
    expect(buildM3u(group!)).toBe('Jogo (USA) (Disc 1).cue\nJogo (USA) (Disc 2).cue\n')
  })
})

describe('buildLpl', () => {
  it('inclui só o que casou com o DAT', () => {
    // Uma playlist é lista de jogos; nome de arquivo cru no menu do emulador não ajuda ninguém.
    const playlist = buildLpl(
      [matched('a.cue', 'Alfa (USA)'), identification('desconhecido.cue')],
      PS1,
    )

    expect(playlist.items).toHaveLength(1)
    expect(playlist.items[0]?.label).toBe('Alfa (USA)')
  })

  it('formata o CRC como o RetroArch espera', () => {
    const playlist = buildLpl([matched('a.cue', 'Alfa', 'abcd1234')], PS1)
    expect(playlist.items[0]?.crc32).toBe('ABCD1234|crc')
  })

  it('aponta para dentro do zip com #', () => {
    const zipped = matched('pack.zip', 'Alfa (USA)')
    zipped.archiveEntry = 'alfa.cue'

    expect(buildLpl([zipped], PS1).items[0]?.path).toBe('/roms/pack.zip#alfa.cue')
  })

  it('usa o nome do DAT do libretro no db_name, que é o que liga às capas', () => {
    expect(buildLpl([matched('a.cue', 'Alfa')], PS1).items[0]?.db_name).toBe(
      'Sony - PlayStation.lpl',
    )
    expect(lplNameFor(PS1)).toBe('Sony - PlayStation.lpl')
  })

  it('deixa o core em DETECT por padrão', () => {
    expect(buildLpl([matched('a.cue', 'Alfa')], PS1).items[0]?.core_path).toBe('DETECT')
  })

  it('ordena por rótulo', () => {
    const playlist = buildLpl(
      [matched('c.cue', 'Zeta'), matched('a.cue', 'Alfa'), matched('b.cue', 'Mega')],
      PS1,
    )

    expect(playlist.items.map((item) => item.label)).toEqual(['Alfa', 'Mega', 'Zeta'])
  })

  it('substitui os discos soltos por uma entrada do .m3u', () => {
    // Listar Disc 1 e Disc 2 ao lado do .m3u devolveria a bagunça que o agrupamento resolve.
    const discs = [
      matched('rpg1.cue', 'Longo RPG (USA) (Disc 1)'),
      matched('rpg2.cue', 'Longo RPG (USA) (Disc 2)'),
    ]
    const playlist = buildLpl([...discs, matched('outro.cue', 'Outro Jogo (USA)')], PS1, {
      discGroups: detectDiscGroups(discs),
      directory: '/roms',
    })

    expect(playlist.items.map((item) => item.label)).toEqual([
      'Longo RPG (USA)',
      'Outro Jogo (USA)',
    ])
    expect(playlist.items[0]?.path).toBe('/roms/Longo RPG (USA).m3u')
  })

  it('sem grupos informados, mantém cada disco como uma entrada', () => {
    const playlist = buildLpl(
      [
        matched('rpg1.cue', 'Longo RPG (USA) (Disc 1)'),
        matched('rpg2.cue', 'Longo RPG (USA) (Disc 2)'),
      ],
      PS1,
    )
    expect(playlist.items).toHaveLength(2)
  })

  it('serializa como JSON válido com os campos que o RetroArch lê', () => {
    const text = serializeLpl(buildLpl([matched('a.cue', 'Alfa')], PS1))
    const parsed = JSON.parse(text)

    expect(parsed.version).toBe('1.5')
    expect(Object.keys(parsed.items[0])).toEqual([
      'path',
      'label',
      'core_path',
      'core_name',
      'crc32',
      'db_name',
    ])
  })
})
