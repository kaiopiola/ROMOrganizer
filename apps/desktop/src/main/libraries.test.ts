import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { journalDirFor, LibraryStore } from './libraries.ts'

let workDir: string
let storePath: string

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-libs-'))
  storePath = join(workDir, 'config', 'libraries.json')
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
})

describe('LibraryStore', () => {
  it('começa vazio quando o arquivo ainda não existe', async () => {
    expect(await new LibraryStore(storePath).list()).toEqual([])
  })

  it('adiciona e persiste, criando o diretório de configuração', async () => {
    const store = new LibraryStore(storePath)
    const library = await store.add('snes', '/roms/snes')

    expect(library.systemId).toBe('snes')
    expect(library.recursive).toBe(false)

    // Uma instância nova lê o que a anterior gravou.
    expect(await new LibraryStore(storePath).list()).toEqual([library])
  })

  it('não duplica quando a mesma pasta é vinculada ao mesmo sistema de novo', async () => {
    const store = new LibraryStore(storePath)
    const first = await store.add('snes', '/roms/snes')
    const second = await store.add('snes', '/roms/snes')

    expect(second.id).toBe(first.id)
    expect(await store.list()).toHaveLength(1)
  })

  it('permite a mesma pasta em sistemas diferentes', async () => {
    // Acontece de verdade: uma pasta "roms" com .md e .bin serve Mega Drive e outros.
    const store = new LibraryStore(storePath)
    await store.add('mega-drive', '/roms/misc')
    await store.add('master-system', '/roms/misc')

    expect(await store.list()).toHaveLength(2)
  })

  it('atualiza e remove', async () => {
    const store = new LibraryStore(storePath)
    const library = await store.add('gb', '/roms/gb')

    expect((await store.update(library.id, { recursive: true }))?.recursive).toBe(true)
    expect((await store.get(library.id))?.recursive).toBe(true)

    await store.remove(library.id)
    expect(await store.list()).toEqual([])
    expect(await store.get(library.id)).toBeUndefined()
  })

  it('sobrevive a um arquivo de configuração corrompido', async () => {
    const store = new LibraryStore(storePath)
    await store.add('gb', '/roms/gb')
    await writeFile(storePath, '{ isto não é json', 'utf8')

    // Melhor abrir vazio que impedir o app de abrir.
    expect(await new LibraryStore(storePath).list()).toEqual([])
  })

  it('grava de forma atômica, sem deixar o arquivo temporário para trás', async () => {
    const store = new LibraryStore(storePath)
    await store.add('gb', '/roms/gb')

    await expect(readFile(`${storePath}.tmp`, 'utf8')).rejects.toThrow()
    expect(JSON.parse(await readFile(storePath, 'utf8'))).toMatchObject({ version: 1 })
  })
})

describe('journalDirFor', () => {
  it('mantém o journal dentro da própria coleção', () => {
    // Assim quem move a pasta de ROMs leva junto a possibilidade de desfazer.
    const path = journalDirFor({ id: 'x', systemId: 'gb', directory: '/roms/gb', recursive: false })
    expect(path).toBe(join('/roms/gb', '.romorg', 'journal'))
  })
})
