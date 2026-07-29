import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashBytes, hashBytesVariants, hashChunks, hashFile } from './rom-hash.ts'
import { inesHeader, pseudoRandomBytes, smcHeader } from '../rom/fixtures.ts'
import { concatBytes, hexToBytes } from '../util/bytes.ts'

let workDir: string

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-hash-'))
})

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true })
})

async function writeTempFile(name: string, content: Uint8Array): Promise<string> {
  const path = join(workDir, name)
  await writeFile(path, content)
  return path
}

describe('hashChunks', () => {
  it('bate com os digests conhecidos de uma entrada vazia', async () => {
    expect(await hashBytes(new Uint8Array(0))).toEqual({
      crc32: '00000000',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
      size: 0,
    })
  })

  it('não depende de como o conteúdo é fatiado em chunks', async () => {
    const data = pseudoRandomBytes(50_000, 9)

    async function* awkwardChunks(): AsyncIterable<Uint8Array> {
      // Tamanhos primos e desalinhados de propósito: é onde o byte swap costuma quebrar.
      for (let offset = 0; offset < data.length; offset += 1013) {
        yield data.subarray(offset, offset + 1013)
      }
    }

    expect(await hashChunks(awkwardChunks(), { swapSize: 4 })).toEqual(
      await hashBytes(data, { swapSize: 4 }),
    )
  })
})

describe('hashChunks — header descontado', () => {
  it('um .nes com header iNES tem o mesmo hash do mesmo dump sem header', async () => {
    const dump = pseudoRandomBytes(32 * 1024, 5)
    const withHeader = concatBytes(inesHeader(), dump)

    const headered = await hashBytes(withHeader, { headerOffset: 16 })
    expect(headered).toEqual(await hashBytes(dump))
    expect(headered.size).toBe(dump.length)
  })

  it('vale também para o header SMC de 512 bytes do SNES', async () => {
    const dump = pseudoRandomBytes(64 * 1024, 11)
    expect(await hashBytes(concatBytes(smcHeader(), dump), { headerOffset: 512 })).toEqual(
      await hashBytes(dump),
    )
  })

  it('descarta o header mesmo quando ele é maior que o primeiro chunk lido', async () => {
    const dump = pseudoRandomBytes(4096, 13)
    const withHeader = concatBytes(new Uint8Array(512), dump)

    async function* tinyChunks(): AsyncIterable<Uint8Array> {
      for (let offset = 0; offset < withHeader.length; offset += 100) {
        yield withHeader.subarray(offset, offset + 100)
      }
    }

    expect(await hashChunks(tinyChunks(), { headerOffset: 512 })).toEqual(await hashBytes(dump))
  })
})

describe('hashChunks — byte order normalizado', () => {
  it('um dump v64 hasheia igual ao mesmo dump em z64', async () => {
    const canonical = concatBytes(hexToBytes('80371240'), pseudoRandomBytes(4096, 3))

    // Constrói a variante v64 invertendo pares de bytes do dump canônico.
    const swapped = Uint8Array.from(canonical)
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const left = swapped[i] as number
      swapped[i] = swapped[i + 1] as number
      swapped[i + 1] = left
    }

    expect(await hashBytes(swapped, { swapSize: 2 })).toEqual(await hashBytes(canonical))
  })

  it('combina desconto de header e byte swap na ordem certa', async () => {
    const dump = concatBytes(hexToBytes('80371240'), pseudoRandomBytes(1024, 17))
    const swapped = Uint8Array.from(dump)
    for (let i = 0; i + 3 < swapped.length; i += 4) {
      for (let a = 0, b = 3; a < b; a += 1, b -= 1) {
        const left = swapped[i + a] as number
        swapped[i + a] = swapped[i + b] as number
        swapped[i + b] = left
      }
    }

    const withHeader = concatBytes(new Uint8Array(64), swapped)
    expect(await hashBytes(withHeader, { headerOffset: 64, swapSize: 4 })).toEqual(
      await hashBytes(dump),
    )
  })
})

describe('hashChunkVariants — as duas leituras de header numa passada só', () => {
  it('devolve o hash com e sem header, ambos corretos', async () => {
    const dump = pseudoRandomBytes(4096, 31)
    const withHeader = concatBytes(inesHeader(), dump)

    const variants = await hashBytesVariants(withHeader, { headerOffset: 16 })

    expect(variants.full).toEqual(await hashBytes(withHeader))
    expect(variants.stripped).toEqual(await hashBytes(dump))
  })

  it('omite a variante sem header quando nenhum header foi detectado', async () => {
    const variants = await hashBytesVariants(pseudoRandomBytes(1024, 37))
    expect(variants.stripped).toBeUndefined()
  })
})

describe('hashFile', () => {
  it('lê do disco e chega ao mesmo resultado que o hash em memória', async () => {
    const dump = pseudoRandomBytes(200_000, 23)
    const path = await writeTempFile('dump.bin', dump)

    expect(await hashFile(path)).toEqual(await hashBytes(dump))
  })

  it('aplica o desconto de header em arquivo do disco', async () => {
    const dump = pseudoRandomBytes(8192, 29)
    const path = await writeTempFile('headered.nes', concatBytes(inesHeader(), dump))

    expect(await hashFile(path, { headerOffset: 16 })).toEqual(await hashBytes(dump))
  })
})
