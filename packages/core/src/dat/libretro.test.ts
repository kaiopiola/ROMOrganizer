import { describe, expect, it } from 'vitest'
import {
  fetchLibretroDat,
  fetchLibretroDatsFor,
  libretroDatUrl,
  libretroRefsFor,
  LibretroFetchError,
} from './libretro.ts'
import type { SystemRulePack } from '../systems/types.ts'

const NES: SystemRulePack = {
  id: 'nes',
  name: 'Nintendo Entertainment System',
  manufacturer: 'Nintendo',
  extensions: ['nes'],
  libretroDat: 'Nintendo - Nintendo Entertainment System',
  header: { size: 16, magic: '4e45531a' },
  defaultTemplate: '{title}.{ext}',
}

const GB: SystemRulePack = {
  id: 'gb',
  name: 'Game Boy',
  manufacturer: 'Nintendo',
  extensions: ['gb'],
  libretroDat: 'Nintendo - Game Boy',
  defaultTemplate: '{title}.{ext}',
}

const SEM_DAT: SystemRulePack = {
  id: 'obscuro',
  name: 'Console Obscuro',
  manufacturer: 'Ninguém',
  extensions: ['obs'],
  defaultTemplate: '{title}.{ext}',
}

const MINIMAL_DAT = `clrmamepro ( name "Nintendo - Game Boy" version "2026.05.02" )
game ( name "Jogo (USA)" rom ( name "Jogo (USA).gb" size 1 crc 00000001 ) )`

function stubFetch(handler: (url: string) => Response): typeof fetch {
  return ((url: string | URL) => Promise.resolve(handler(String(url)))) as typeof fetch
}

describe('libretroDatUrl', () => {
  it('escapa espaços e hífens do nome do DAT', () => {
    expect(libretroDatUrl({ name: 'Nintendo - Game Boy', collection: 'no-intro' })).toBe(
      'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/no-intro/Nintendo%20-%20Game%20Boy.dat',
    )
  })

  it('permite fixar uma referência git', () => {
    expect(libretroDatUrl({ name: 'X', collection: 'redump' }, 'v1.2.3')).toContain('/v1.2.3/')
  })
})

describe('libretroRefsFor', () => {
  it('pede também a versão headered para sistemas com header', () => {
    expect(libretroRefsFor(NES).map((ref) => ref.collection)).toEqual(['no-intro', 'headered'])
  })

  it('pede só a no-intro para sistemas sem header', () => {
    expect(libretroRefsFor(GB).map((ref) => ref.collection)).toEqual(['no-intro'])
  })

  it('não pede nada para sistema sem DAT declarado', () => {
    expect(libretroRefsFor(SEM_DAT)).toEqual([])
  })
})

describe('fetchLibretroDat', () => {
  it('baixa e parseia', async () => {
    const parsed = await fetchLibretroDat(
      { name: 'Nintendo - Game Boy', collection: 'no-intro' },
      { fetchImpl: stubFetch(() => new Response(MINIMAL_DAT, { status: 200 })) },
    )
    expect(parsed.name).toBe('Nintendo - Game Boy')
    expect(parsed.entries).toHaveLength(1)
  })

  it('erro HTTP vira LibretroFetchError com o status preservado', async () => {
    await expect(
      fetchLibretroDat(
        { name: 'Inexistente', collection: 'no-intro' },
        { fetchImpl: stubFetch(() => new Response('', { status: 404 })) },
      ),
    ).rejects.toMatchObject({ name: 'LibretroFetchError', status: 404 })
  })
})

describe('fetchLibretroDatsFor', () => {
  it('junta no-intro e headered quando as duas existem', async () => {
    const result = await fetchLibretroDatsFor(NES, {
      fetchImpl: stubFetch(
        (url) =>
          new Response(
            url.includes('/headered/')
              ? MINIMAL_DAT.replace('Nintendo - Game Boy', 'NES (headered)')
              : MINIMAL_DAT.replace('Nintendo - Game Boy', 'NES'),
            { status: 200 },
          ),
      ),
    })

    expect(result.parsed.map((dat) => dat.name)).toEqual(['NES', 'NES (headered)'])
    expect(result.missing).toEqual([])
  })

  it('trata 404 na coleção headered como ausência esperada, não como falha', async () => {
    const result = await fetchLibretroDatsFor(NES, {
      fetchImpl: stubFetch((url) =>
        url.includes('/headered/')
          ? new Response('', { status: 404 })
          : new Response(MINIMAL_DAT, { status: 200 }),
      ),
    })

    expect(result.parsed).toHaveLength(1)
    expect(result.missing).toEqual([
      { name: 'Nintendo - Nintendo Entertainment System', collection: 'headered' },
    ])
  })

  it('propaga falha de rede em vez de silenciá-la como DAT ausente', async () => {
    await expect(
      fetchLibretroDatsFor(GB, {
        fetchImpl: (() => Promise.reject(new Error('getaddrinfo ENOTFOUND'))) as typeof fetch,
      }),
    ).rejects.toThrow(/ENOTFOUND/)
  })

  it('propaga rate limit, que não é a mesma coisa que DAT inexistente', async () => {
    await expect(
      fetchLibretroDatsFor(GB, {
        fetchImpl: stubFetch(() => new Response('', { status: 429 })),
      }),
    ).rejects.toBeInstanceOf(LibretroFetchError)
  })
})
