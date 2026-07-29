import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isZipPath, listZipEntries, openZipEntry, ZipError } from './zip.ts'
import { crc32 } from '../hash/crc32.ts'
import { hashBytes, hashChunks } from '../hash/rom-hash.ts'
import { inesHeader, pseudoRandomBytes } from '../rom/fixtures.ts'
import { concatBytes } from '../util/bytes.ts'

const run = promisify(execFile)

let workDir: string

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-zip-'))
})

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true })
})

/** Monta um zip de verdade com o `zip` do sistema, em vez de um fixture binário no repo. */
async function makeZip(zipName: string, files: Record<string, Uint8Array>): Promise<string> {
  const stageDir = join(workDir, `stage-${zipName}`)
  await mkdir(stageDir, { recursive: true })

  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(stageDir, name), content)
  }

  const zipPath = join(workDir, zipName)
  await run('zip', ['-q', '-r', '-X', zipPath, '.'], { cwd: stageDir })
  return zipPath
}

describe('isZipPath', () => {
  it('reconhece a extensão, ignorando caixa', () => {
    expect(isZipPath('jogo.zip')).toBe(true)
    expect(isZipPath('JOGO.ZIP')).toBe(true)
    expect(isZipPath('jogo.7z')).toBe(false)
  })
})

describe('listZipEntries', () => {
  it('lista as entradas com o CRC32 que o próprio zip armazena', async () => {
    const dump = pseudoRandomBytes(4096, 71)
    const zipPath = await makeZip('simples.zip', { 'Jogo (USA).nes': dump })

    const entries = await listZipEntries(zipPath)

    expect(entries).toHaveLength(1)
    expect(entries[0]?.name).toBe('Jogo (USA).nes')
    expect(entries[0]?.size).toBe(dump.length)
    // É este o atalho que evita descomprimir para identificar.
    expect(entries[0]?.crc32).toBe(crc32(dump))
  })

  it('lista múltiplas entradas', async () => {
    const zipPath = await makeZip('multi.zip', {
      'a.nes': pseudoRandomBytes(128, 73),
      'b.nes': pseudoRandomBytes(256, 79),
    })

    const names = (await listZipEntries(zipPath)).map((entry) => entry.name).sort()
    expect(names).toEqual(['a.nes', 'b.nes'])
  })

  it('não devolve diretórios como se fossem arquivos', async () => {
    const stageDir = join(workDir, 'com-pasta')
    await mkdir(join(stageDir, 'sub'), { recursive: true })
    await writeFile(join(stageDir, 'sub', 'dentro.nes'), pseudoRandomBytes(64, 83))

    const zipPath = join(workDir, 'com-pasta.zip')
    await run('zip', ['-q', '-r', '-X', zipPath, '.'], { cwd: stageDir })

    const entries = await listZipEntries(zipPath)
    expect(entries.map((entry) => entry.name)).toEqual(['sub/dentro.nes'])
  })

  it('falha com erro nomeado quando o arquivo não é um zip', async () => {
    const fake = join(workDir, 'nao-e-zip.zip')
    await writeFile(fake, 'isto é texto puro')

    await expect(listZipEntries(fake)).rejects.toBeInstanceOf(ZipError)
  })
})

describe('openZipEntry', () => {
  it('entrega o conteúdo descomprimido, byte a byte igual ao original', async () => {
    const dump = pseudoRandomBytes(10_000, 89)
    const zipPath = await makeZip('conteudo.zip', { 'rom.nes': dump })

    const hashes = await hashChunks(await openZipEntry(zipPath, 'rom.nes'))
    expect(hashes).toEqual(await hashBytes(dump))
  })

  it('desconta header de uma ROM dentro do zip, como faria em disco', async () => {
    const dump = pseudoRandomBytes(8192, 97)
    const zipPath = await makeZip('headered.zip', {
      'headered.nes': concatBytes(inesHeader(), dump),
    })

    const hashes = await hashChunks(await openZipEntry(zipPath, 'headered.nes'), {
      headerOffset: 16,
    })
    expect(hashes).toEqual(await hashBytes(dump))
  })

  it('erra de forma clara quando a entrada não existe', async () => {
    const zipPath = await makeZip('vazio-ish.zip', { 'existe.nes': pseudoRandomBytes(16, 101) })

    await expect(openZipEntry(zipPath, 'nao-existe.nes')).rejects.toThrow(/não encontrada/)
  })
})
