import { mkdtemp, readdir, rm, utimes, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SystemRulePack } from '@romorg/core'
import { DatCache } from './dat-cache.ts'

const GB: SystemRulePack = {
  id: 'gb',
  name: 'Game Boy',
  manufacturer: 'Nintendo',
  extensions: ['gb'],
  libretroDat: 'Nintendo - Game Boy',
  defaultTemplate: '{title}.{ext}',
}

const DAT_TEXT = `clrmamepro ( name "Nintendo - Game Boy" version "2026.05.02" )
game ( name "Jogo (USA)" rom ( name "Jogo (USA).gb" size 1 crc 00000001 ) )`

let workDir: string
let cacheDir: string

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-datcache-'))
  cacheDir = join(workDir, 'dat-cache')
  vi.restoreAllMocks()
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function stubFetch(responder: () => Response): void {
  vi.stubGlobal('fetch', () => Promise.resolve(responder()))
}

describe('DatCache', () => {
  it('baixa na primeira vez e grava em disco', async () => {
    let calls = 0
    stubFetch(() => {
      calls += 1
      return new Response(DAT_TEXT, { status: 200 })
    })

    const cache = new DatCache(cacheDir)
    const dats = await cache.getFor(GB)

    expect(dats[0]?.name).toBe('Nintendo - Game Boy')
    expect(calls).toBe(1)
    expect(await readdir(cacheDir)).toEqual(['gb.json'])
  })

  it('não rebaixa enquanto o cache está fresco', async () => {
    let calls = 0
    stubFetch(() => {
      calls += 1
      return new Response(DAT_TEXT, { status: 200 })
    })

    const cache = new DatCache(cacheDir)
    await cache.getFor(GB)
    await cache.getFor(GB)

    expect(calls).toBe(1)
  })

  it('rebaixa quando o cache venceu', async () => {
    let calls = 0
    stubFetch(() => {
      calls += 1
      return new Response(DAT_TEXT, { status: 200 })
    })

    const cache = new DatCache(cacheDir, 7)
    await cache.getFor(GB)

    // Envelhece o arquivo além do limite.
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await utimes(join(cacheDir, 'gb.json'), old, old)

    await cache.getFor(GB)
    expect(calls).toBe(2)
  })

  it('força o download mesmo com cache fresco', async () => {
    let calls = 0
    stubFetch(() => {
      calls += 1
      return new Response(DAT_TEXT, { status: 200 })
    })

    const cache = new DatCache(cacheDir)
    await cache.getFor(GB)
    await cache.getFor(GB, true)

    expect(calls).toBe(2)
  })

  it('cai para o cache vencido quando a rede falha', async () => {
    stubFetch(() => new Response(DAT_TEXT, { status: 200 }))
    const cache = new DatCache(cacheDir, 7)
    await cache.getFor(GB)

    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await utimes(join(cacheDir, 'gb.json'), old, old)

    vi.stubGlobal('fetch', () => Promise.reject(new Error('sem rede')))

    // Um DAT de semana passada identifica muito mais que DAT nenhum.
    const dats = await cache.getFor(GB)
    expect(dats[0]?.name).toBe('Nintendo - Game Boy')
  })

  it('propaga a falha quando não há nem cache vencido', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('sem rede')))
    await expect(new DatCache(cacheDir).getFor(GB)).rejects.toThrow(/sem rede/)
  })

  it('reporta o que está em cache', async () => {
    await mkdir(cacheDir, { recursive: true })
    await writeFile(join(cacheDir, 'snes.json'), '[]', 'utf8')

    const status = await new DatCache(cacheDir).status()
    expect(status.map((entry) => entry.systemId)).toEqual(['snes'])
    expect(Number.isNaN(Date.parse(status[0]?.updatedAt as string))).toBe(false)
  })

  it('reporta vazio quando nunca houve cache', async () => {
    expect(await new DatCache(join(workDir, 'inexistente')).status()).toEqual([])
  })
})
