import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HashCache } from './hash-cache.ts'
import type { RomHashVariants } from '../hash/rom-hash.ts'

const VARIANTS: RomHashVariants = {
  full: { crc32: 'deadbeef', md5: 'a'.repeat(32), sha1: 'b'.repeat(40), size: 1024 },
}

let workDir: string
let cachePath: string

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-cache-'))
  cachePath = join(workDir, '.romorg', 'hashes.json')
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
})

describe('HashCache', () => {
  it('devolve o que guardou', () => {
    const cache = new HashCache()
    const key = { path: '/roms/a.nes', size: 1024, mtimeMs: 1000 }

    cache.set(key, VARIANTS)
    expect(cache.get(key)).toEqual(VARIANTS)
  })

  it('ignora a entrada quando o tamanho mudou', () => {
    const cache = new HashCache()
    cache.set({ path: '/roms/a.nes', size: 1024, mtimeMs: 1000 }, VARIANTS)

    expect(cache.get({ path: '/roms/a.nes', size: 2048, mtimeMs: 1000 })).toBeUndefined()
  })

  it('ignora a entrada quando o arquivo foi modificado', () => {
    const cache = new HashCache()
    cache.set({ path: '/roms/a.nes', size: 1024, mtimeMs: 1000 }, VARIANTS)

    expect(cache.get({ path: '/roms/a.nes', size: 1024, mtimeMs: 2000 })).toBeUndefined()
  })

  it('distingue entradas diferentes dentro do mesmo zip', () => {
    const cache = new HashCache()
    const base = { path: '/roms/pack.zip', size: 1024, mtimeMs: 1000 }

    cache.set({ ...base, entry: 'a.nes' }, VARIANTS)

    expect(cache.get({ ...base, entry: 'a.nes' })).toEqual(VARIANTS)
    expect(cache.get({ ...base, entry: 'b.nes' })).toBeUndefined()
    expect(cache.get(base)).toBeUndefined()
  })

  it('sobrevive a uma ida e volta ao disco', async () => {
    const cache = new HashCache()
    const key = { path: '/roms/a.nes', size: 1024, mtimeMs: 1000 }
    cache.set(key, VARIANTS)
    await cache.save(cachePath)

    expect((await HashCache.load(cachePath)).get(key)).toEqual(VARIANTS)
  })

  it('não grava quando nada mudou', async () => {
    const cache = new HashCache()
    cache.set({ path: '/a.nes', size: 1, mtimeMs: 1 }, VARIANTS)
    await cache.save(cachePath)

    const reloaded = await HashCache.load(cachePath)
    await reloaded.save(join(workDir, 'nao-deve-existir.json'))

    expect(await readdir(workDir)).not.toContain('nao-deve-existir.json')
  })

  it('começa vazio quando o arquivo não existe', async () => {
    expect((await HashCache.load(join(workDir, 'inexistente.json'))).size).toBe(0)
  })

  it('começa vazio quando o arquivo está corrompido', async () => {
    // Cache é otimização: perdê-lo custa tempo, nunca correção.
    await writeFile(join(workDir, 'ruim.json'), '{ não é json', 'utf8')
    expect((await HashCache.load(join(workDir, 'ruim.json'))).size).toBe(0)
  })

  it('descarta entradas de arquivos que sumiram', () => {
    const cache = new HashCache()
    cache.set({ path: '/roms/velho.nes', size: 1, mtimeMs: 1 }, VARIANTS)
    cache.set({ path: '/roms/atual.nes', size: 1, mtimeMs: 1 }, VARIANTS)
    cache.set({ path: '/roms/pack.zip', entry: 'x.nes', size: 1, mtimeMs: 1 }, VARIANTS)

    // O próprio app renomeia; sem poda, cada rename deixaria uma chave órfã para sempre.
    cache.retainOnly(['/roms/atual.nes', '/roms/pack.zip'])

    expect(cache.size).toBe(2)
    expect(cache.get({ path: '/roms/velho.nes', size: 1, mtimeMs: 1 })).toBeUndefined()
    expect(cache.get({ path: '/roms/atual.nes', size: 1, mtimeMs: 1 })).toEqual(VARIANTS)
  })
})
