import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scanDirectory } from './scan.ts'
import { DatIndex } from '../dat/index-db.ts'
import { hashBytes } from '../hash/rom-hash.ts'
import { pseudoRandomBytes } from '../rom/fixtures.ts'
import type { SystemRulePack } from '../systems/types.ts'

const NES: SystemRulePack = {
  id: 'nes',
  name: 'Nintendo Entertainment System',
  manufacturer: 'Nintendo',
  extensions: ['nes'],
  defaultTemplate: '{title}[ ({region})].{ext}',
}

let workDir: string
let index: DatIndex

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-scan-'))
  index = new DatIndex()
})

afterEach(async () => {
  index.close()
  await rm(workDir, { recursive: true, force: true })
})

describe('scanDirectory', () => {
  it('só considera arquivos com extensão do sistema', async () => {
    await writeFile(join(workDir, 'a.nes'), pseudoRandomBytes(64, 1))
    await writeFile(join(workDir, 'b.nes'), pseudoRandomBytes(64, 2))
    await writeFile(join(workDir, 'leiame.txt'), 'nada a ver')
    await writeFile(join(workDir, 'capa.png'), pseudoRandomBytes(16, 3))

    const { results } = await scanDirectory(workDir, NES, index)
    expect(results.map((result) => result.fileName)).toEqual(['a.nes', 'b.nes'])
  })

  it('ignora lixo de sistema operacional', async () => {
    await writeFile(join(workDir, '.DS_Store'), 'x')
    await writeFile(join(workDir, 'jogo.nes'), pseudoRandomBytes(64, 4))

    const { results } = await scanDirectory(workDir, NES, index)
    expect(results).toHaveLength(1)
  })

  it('não desce em subpastas por padrão', async () => {
    await mkdir(join(workDir, 'sub'))
    await writeFile(join(workDir, 'sub', 'dentro.nes'), pseudoRandomBytes(64, 5))
    await writeFile(join(workDir, 'fora.nes'), pseudoRandomBytes(64, 6))

    const shallow = await scanDirectory(workDir, NES, index)
    expect(shallow.results.map((result) => result.fileName)).toEqual(['fora.nes'])

    const deep = await scanDirectory(workDir, NES, index, { recursive: true })
    expect(deep.results.map((result) => result.fileName).sort()).toEqual(['dentro.nes', 'fora.nes'])
  })

  it('identifica contra o índice e reporta progresso', async () => {
    const dump = pseudoRandomBytes(256, 7)
    index.importDat({
      name: 'Test DAT',
      entries: [
        {
          gameName: 'Jogo Bom (USA)',
          romName: 'Jogo Bom (USA).nes',
          size: dump.length,
          crc32: (await hashBytes(dump)).crc32,
        },
      ],
    })
    await writeFile(join(workDir, 'nome_ruim.nes'), dump)

    const progress: number[] = []
    const { results } = await scanDirectory(workDir, NES, index, {
      onProgress: (done, total) => progress.push(done / total),
    })

    expect(results[0]?.proposedName).toBe('Jogo Bom (USA).nes')
    expect(progress).toEqual([1])
  })

  it('mantém a ordem dos arquivos mesmo com concorrência', async () => {
    for (const name of ['c.nes', 'a.nes', 'b.nes']) {
      await writeFile(join(workDir, name), pseudoRandomBytes(4096, name.charCodeAt(0)))
    }

    const { results } = await scanDirectory(workDir, NES, index, { concurrency: 3 })
    expect(results.map((result) => result.fileName)).toEqual(['a.nes', 'b.nes', 'c.nes'])
  })

  it('um arquivo ilegível não derruba o scan inteiro', async () => {
    await writeFile(join(workDir, 'ok.nes'), pseudoRandomBytes(64, 8))
    // Diretório com extensão de ROM: entra na varredura como caminho, mas falha ao ser lido.
    await mkdir(join(workDir, 'pasta.nes'))

    const summary = await scanDirectory(workDir, NES, index, { recursive: true })
    expect(summary.results.map((result) => result.fileName)).toEqual(['ok.nes'])
    expect(summary.failures).toEqual([])
  })

  it('varre .zip junto com as ROMs soltas', async () => {
    const dump = pseudoRandomBytes(512, 41)
    index.importDat({
      name: 'Test DAT',
      entries: [
        {
          gameName: 'Jogo Compactado (USA)',
          romName: 'Jogo Compactado (USA).nes',
          size: dump.length,
          crc32: (await hashBytes(dump)).crc32,
        },
      ],
    })

    const stageDir = join(workDir, 'stage')
    await mkdir(stageDir, { recursive: true })
    await writeFile(join(stageDir, 'interno.nes'), dump)
    await promisify(execFile)('zip', ['-q', '-r', '-X', join(workDir, 'coleção.zip'), '.'], {
      cwd: stageDir,
    })
    await rm(stageDir, { recursive: true })
    await writeFile(join(workDir, 'solta.nes'), pseudoRandomBytes(64, 43))

    const { results } = await scanDirectory(workDir, NES, index)

    expect(results).toHaveLength(2)
    const zipado = results.find((result) => result.archiveEntry !== undefined)
    expect(zipado?.proposedName).toBe('Jogo Compactado (USA).zip')
    expect(zipado?.fromArchiveIndex).toBe(true)
  })

  it('um zip com duas ROMs rende dois resultados', async () => {
    const stageDir = join(workDir, 'stage2')
    await mkdir(stageDir, { recursive: true })
    await writeFile(join(stageDir, 'a.nes'), pseudoRandomBytes(64, 47))
    await writeFile(join(stageDir, 'b.nes'), pseudoRandomBytes(64, 53))
    await promisify(execFile)('zip', ['-q', '-r', '-X', join(workDir, 'duplo.zip'), '.'], {
      cwd: stageDir,
    })
    await rm(stageDir, { recursive: true })

    const { results } = await scanDirectory(workDir, NES, index)
    expect(results).toHaveLength(2)
    expect(results.every((result) => result.fileName === 'duplo.zip')).toBe(true)
  })

  it('respeita o cancelamento', async () => {
    for (let i = 0; i < 20; i += 1) {
      await writeFile(join(workDir, `rom${i}.nes`), pseudoRandomBytes(1024, i))
    }

    const controller = new AbortController()
    controller.abort()

    await expect(
      scanDirectory(workDir, NES, index, { signal: controller.signal }),
    ).rejects.toThrow()
  })
})
