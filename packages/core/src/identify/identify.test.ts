import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { identifyFile } from './identify.ts'
import { DatIndex } from '../dat/index-db.ts'
import { hashBytes } from '../hash/rom-hash.ts'
import { inesHeader, pseudoRandomBytes } from '../rom/fixtures.ts'
import { concatBytes, hexToBytes } from '../util/bytes.ts'
import type { SystemRulePack } from '../systems/types.ts'

const NES: SystemRulePack = {
  id: 'nes',
  name: 'Nintendo Entertainment System',
  manufacturer: 'Nintendo',
  extensions: ['nes'],
  header: { size: 16, magic: '4e45531a' },
  defaultTemplate: '{title}[ ({region})].{ext}',
}

const N64: SystemRulePack = {
  id: 'n64',
  name: 'Nintendo 64',
  manufacturer: 'Nintendo',
  extensions: ['n64', 'v64', 'z64'],
  byteOrder: {
    canonicalMagic: '80371240',
    variants: [{ id: 'v64', magic: '37804012', swapSize: 2 }],
  },
  defaultTemplate: '{title}[ ({region})].z64',
}

let workDir: string
let index: DatIndex

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-identify-'))
})

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true })
})

beforeEach(() => {
  index = new DatIndex()
})

afterEach(() => {
  index.close()
})

async function writeRom(name: string, content: Uint8Array): Promise<string> {
  const path = join(workDir, name)
  await writeFile(path, content)
  return path
}

describe('identifyFile — match por hash', () => {
  it('identifica um arquivo sem header pelo CRC32', async () => {
    const dump = pseudoRandomBytes(4096, 101)
    const hashes = await hashBytes(dump)
    index.importDat({
      name: 'Test DAT',
      entries: [
        {
          gameName: 'Jogo Certo (USA)',
          romName: 'Jogo Certo (USA).nes',
          size: dump.length,
          crc32: hashes.crc32,
        },
      ],
    })

    const result = await identifyFile(await writeRom('qualquer_nome.nes', dump), NES, index)

    expect(result.method).toBe('hash')
    expect(result.matchedBy).toBe('crc32')
    expect(result.proposedName).toBe('Jogo Certo (USA).nes')
    expect(result.ambiguous).toBe(false)
  })

  it('identifica um .nes com header iNES contra um DAT headerless', async () => {
    const dump = pseudoRandomBytes(8192, 103)
    const hashes = await hashBytes(dump)
    index.importDat({
      name: 'No-Intro NES',
      entries: [
        {
          gameName: 'Jogo Com Header (Japan)',
          romName: 'Jogo Com Header (Japan).nes',
          size: dump.length,
          sha1: hashes.sha1,
        },
      ],
    })

    const path = await writeRom('headered.nes', concatBytes(inesHeader(), dump))
    const result = await identifyFile(path, NES, index)

    // O DAT é headerless, então o match só acontece na variante sem os 16 bytes.
    expect(result.method).toBe('hash-headerless')
    expect(result.header).toEqual({ offset: 16, method: 'magic' })
    expect(result.proposedName).toBe('Jogo Com Header (Japan).nes')
  })

  it('identifica o mesmo arquivo contra um DAT que inclui o header no hash', async () => {
    const dump = pseudoRandomBytes(8192, 107)
    const withHeader = concatBytes(inesHeader(), dump)
    index.importDat({
      name: 'DAT Headered',
      entries: [
        {
          gameName: 'Jogo Headered (USA)',
          romName: 'Jogo Headered (USA).nes',
          size: withHeader.length,
          crc32: (await hashBytes(withHeader)).crc32,
        },
      ],
    })

    const result = await identifyFile(await writeRom('outro.nes', withHeader), NES, index)

    // Mesma ROM, DAT com convenção oposta: o match vem da variante completa.
    expect(result.method).toBe('hash')
    expect(result.proposedName).toBe('Jogo Headered (USA).nes')
  })

  it('identifica um dump v64 contra um DAT em z64', async () => {
    const canonical = concatBytes(hexToBytes('80371240'), pseudoRandomBytes(2048, 109))
    index.importDat({
      name: 'No-Intro N64',
      entries: [
        {
          gameName: 'Jogo N64 (Europe)',
          romName: 'Jogo N64 (Europe).z64',
          size: canonical.length,
          crc32: (await hashBytes(canonical)).crc32,
        },
      ],
    })

    const swapped = Uint8Array.from(canonical)
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const left = swapped[i] as number
      swapped[i] = swapped[i + 1] as number
      swapped[i + 1] = left
    }

    const result = await identifyFile(await writeRom('jogo.v64', swapped), N64, index)

    expect(result.byteOrder.variantId).toBe('v64')
    expect(result.method).toBe('hash')
    // A extensão de saída acompanha o arquivo; a normalização de nome é decisão do plano.
    expect(result.proposedName).toBe('Jogo N64 (Europe).v64')
  })

  it('sinaliza ambiguidade quando dois DATs dão nomes diferentes ao mesmo hash', async () => {
    const dump = pseudoRandomBytes(1024, 113)
    const { crc32 } = await hashBytes(dump)

    index.importDat({
      name: 'DAT A',
      entries: [{ gameName: 'Jogo (USA)', romName: 'Jogo (USA).nes', size: 1024, crc32 }],
    })
    index.importDat({
      name: 'DAT B',
      entries: [{ gameName: 'Jogo Alternativo', romName: 'Jogo Alt.nes', size: 1024, crc32 }],
    })

    const result = await identifyFile(await writeRom('ambiguo.nes', dump), NES, index)

    expect(result.matches).toHaveLength(2)
    expect(result.ambiguous).toBe(true)
  })

  it('não marca ambiguidade quando os DATs concordam no nome', async () => {
    const dump = pseudoRandomBytes(1024, 127)
    const { crc32 } = await hashBytes(dump)
    const entry = { gameName: 'Jogo (USA)', romName: 'Jogo (USA).nes', size: 1024, crc32 }

    index.importDat({ name: 'DAT A', entries: [entry] })
    index.importDat({ name: 'DAT B', entries: [entry] })

    const result = await identifyFile(await writeRom('concordam.nes', dump), NES, index)
    expect(result.ambiguous).toBe(false)
  })
})

describe('identifyFile — sem match no índice', () => {
  it('cai para o nome do arquivo quando ele segue uma convenção conhecida', async () => {
    const path = await writeRom('Jogo Solto (USA) (Rev A).nes', pseudoRandomBytes(512, 131))
    const result = await identifyFile(path, NES, index)

    expect(result.method).toBe('filename')
    expect(result.matches).toEqual([])
    expect(result.parsedName.regions).toEqual(['USA'])
    expect(result.proposedName).toBe('Jogo Solto (USA).nes')
  })

  it('não propõe nome nenhum quando não há hash nem convenção', async () => {
    const path = await writeRom('dump_0042.nes', pseudoRandomBytes(512, 137))
    const result = await identifyFile(path, NES, index)

    expect(result.method).toBe('unidentified')
    expect(result.proposedName).toBeNull()
  })

  it('ainda devolve os hashes calculados, para o usuário poder reportar o arquivo', async () => {
    const dump = pseudoRandomBytes(512, 139)
    const result = await identifyFile(await writeRom('sem_match.nes', dump), NES, index)

    expect(result.hashes).toEqual(await hashBytes(dump))
  })
})
