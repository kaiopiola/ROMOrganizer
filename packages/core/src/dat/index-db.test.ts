import { afterEach, describe, expect, it } from 'vitest'
import { DatIndex } from './index-db.ts'
import type { ParsedDat } from './logiqx.ts'

let index: DatIndex

function openIndex(): DatIndex {
  index = new DatIndex()
  return index
}

afterEach(() => {
  index.close()
})

const NO_INTRO: ParsedDat = {
  name: 'No-Intro Test System',
  version: '20260101',
  entries: [
    {
      gameName: 'Super Test Bros. (USA)',
      romName: 'Super Test Bros. (USA).sfc',
      size: 524288,
      crc32: 'b19ed489',
      sha1: '0123456789abcdef0123456789abcdef01234567',
    },
    {
      gameName: 'Super Test Bros. (Japan)',
      romName: 'Super Test Bros. (Japan).sfc',
      size: 524288,
      crc32: 'aabbccdd',
    },
  ],
}

describe('DatIndex', () => {
  it('importa e conta as entradas', () => {
    const db = openIndex()
    expect(db.importDat(NO_INTRO)).toBe(2)
    expect(db.sources()).toEqual([
      { name: 'No-Intro Test System', version: '20260101', romCount: 2 },
    ])
  })

  it('encontra por CRC32', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)

    const result = db.lookup({ crc32: 'aabbccdd' })
    expect(result?.matchedBy).toBe('crc32')
    expect(result?.matches[0]?.gameName).toBe('Super Test Bros. (Japan)')
  })

  it('aceita hash em maiúsculas', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)
    expect(db.lookup({ crc32: 'AABBCCDD' })?.matches).toHaveLength(1)
  })

  it('prefere SHA1 a CRC32 quando os dois estão disponíveis', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)

    // CRC que casaria com a entrada japonesa, mas o SHA1 aponta para a americana:
    // o hash mais forte tem que vencer.
    const result = db.lookup({
      sha1: '0123456789abcdef0123456789abcdef01234567',
      crc32: 'aabbccdd',
    })
    expect(result?.matchedBy).toBe('sha1')
    expect(result?.matches[0]?.gameName).toBe('Super Test Bros. (USA)')
  })

  it('cai para o hash seguinte quando o mais forte não casa', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)

    const result = db.lookup({ sha1: 'f'.repeat(40), crc32: 'aabbccdd' })
    expect(result?.matchedBy).toBe('crc32')
  })

  it('devolve null quando nada casa', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)
    expect(db.lookup({ crc32: '00000000' })).toBeNull()
  })

  it('devolve todos os candidatos quando o mesmo hash está em DATs diferentes', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)
    db.importDat({
      name: 'Libretro Test System',
      entries: [
        {
          gameName: 'Super Test Bros (USA)',
          romName: 'Super Test Bros (USA).sfc',
          size: 524288,
          crc32: 'aabbccdd',
        },
      ],
    })

    const result = db.lookup({ crc32: 'aabbccdd' })
    expect(result?.matches).toHaveLength(2)
    expect(result?.matches.map((match) => match.datSource)).toEqual([
      'Libretro Test System',
      'No-Intro Test System',
    ])
  })

  it('reimportar o mesmo DAT substitui, em vez de duplicar', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)
    db.importDat({ ...NO_INTRO, version: '20260202', entries: [NO_INTRO.entries[0]!] })

    expect(db.sources()).toEqual([
      { name: 'No-Intro Test System', version: '20260202', romCount: 1 },
    ])
    expect(db.lookup({ crc32: 'aabbccdd' })).toBeNull()
  })

  it('não deixa entradas órfãs quando a importação falha no meio', () => {
    const db = openIndex()
    db.importDat(NO_INTRO)

    const corrupted = {
      ...NO_INTRO,
      entries: [NO_INTRO.entries[0]!, { ...NO_INTRO.entries[1]!, size: undefined as never }],
    }
    expect(() => db.importDat(corrupted)).toThrow()

    // O DAT anterior continua íntegro: o rollback desfez a remoção e a inserção parcial.
    expect(db.sources()[0]?.romCount).toBe(2)
  })
})
