import { readFileSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { executePlan, readJournal, undoFromJournal } from './execute.ts'
import { planRenames } from './plan.ts'
import type { Identification } from '../identify/identify.ts'
import type { RenamePlan } from './plan.ts'
import type { SystemRulePack } from '../systems/types.ts'

const NES: SystemRulePack = {
  id: 'nes',
  name: 'Nintendo Entertainment System',
  manufacturer: 'Nintendo',
  extensions: ['nes'],
  defaultTemplate: '{title}.{ext}',
}

let workDir: string
let journalDir: string

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'romorg-exec-'))
  journalDir = join(workDir, '.journal')
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
})

function identification(fileName: string, proposedName: string): Identification {
  return {
    filePath: join(workDir, fileName),
    fileName,
    system: NES,
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
    proposedName,
  }
}

function planOf(pairs: [string, string][]): RenamePlan {
  return planRenames(pairs.map(([from, to]) => identification(from, to)))
}

async function listFiles(): Promise<string[]> {
  const entries = await readdir(workDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
}

describe('executePlan', () => {
  it('renomeia e registra no journal', async () => {
    await writeFile(join(workDir, 'bagunca.nes'), 'conteudo')

    const result = await executePlan(planOf([['bagunca.nes', 'Jogo (USA).nes']]), { journalDir })

    expect(await listFiles()).toEqual(['Jogo (USA).nes'])
    expect(result.applied).toHaveLength(1)
    expect(result.failed).toEqual([])

    const journal = await readJournal(result.journalPath as string)
    expect(journal[0]?.from).toBe(join(workDir, 'bagunca.nes'))
    expect(journal[0]?.to).toBe(join(workDir, 'Jogo (USA).nes'))
  })

  it('preserva o conteúdo — renomear não é copiar', async () => {
    await writeFile(join(workDir, 'x.nes'), 'bytes preciosos')
    await executePlan(planOf([['x.nes', 'Y.nes']]), { journalDir })

    expect(await readFile(join(workDir, 'Y.nes'), 'utf8')).toBe('bytes preciosos')
  })

  it('não escreve journal quando não há nada a fazer', async () => {
    const result = await executePlan({ operations: [], skipped: [] }, { journalDir })
    expect(result.journalPath).toBeNull()
  })

  it('nunca sobrescreve um arquivo existente', async () => {
    await writeFile(join(workDir, 'origem.nes'), 'novo')
    await writeFile(join(workDir, 'destino.nes'), 'PRECIOSO')

    // Plano construído à mão: o planner teria barrado isso, mas o executor é a última linha
    // de defesa e precisa se segurar sozinho.
    const result = await executePlan(
      {
        operations: [
          {
            from: join(workDir, 'origem.nes'),
            to: join(workDir, 'destino.nes'),
            identification: identification('origem.nes', 'destino.nes'),
          },
        ],
        skipped: [],
      },
      { journalDir },
    )

    expect(result.applied).toEqual([])
    expect(result.failed[0]?.reason).toMatch(/já existe/)
    expect(await readFile(join(workDir, 'destino.nes'), 'utf8')).toBe('PRECIOSO')
    expect(await readFile(join(workDir, 'origem.nes'), 'utf8')).toBe('novo')
  })

  it('renomeia mudando só a caixa, que é no-op em FS case-insensitive', async () => {
    await writeFile(join(workDir, 'MARIO.NES'), 'conteudo')

    const result = await executePlan(planOf([['MARIO.NES', 'Mario.nes']]), { journalDir })

    expect(result.failed).toEqual([])
    expect(await listFiles()).toEqual(['Mario.nes'])
    expect(await readFile(join(workDir, 'Mario.nes'), 'utf8')).toBe('conteudo')
  })

  it('cria as subpastas que o template pedir', async () => {
    await writeFile(join(workDir, 'x.nes'), 'conteudo')

    const result = await executePlan(planOf([['x.nes', 'USA/1991/Jogo.nes']]), { journalDir })

    expect(result.failed).toEqual([])
    expect(await readFile(join(workDir, 'USA', '1991', 'Jogo.nes'), 'utf8')).toBe('conteudo')
  })

  it('desfaz um rename que criou subpasta, devolvendo o arquivo à raiz', async () => {
    await writeFile(join(workDir, 'x.nes'), 'conteudo')
    const result = await executePlan(planOf([['x.nes', 'USA/Jogo.nes']]), { journalDir })

    await undoFromJournal(result.journalPath as string)
    expect(await listFiles()).toEqual(['x.nes'])
  })

  it('uma falha no meio não impede as demais operações', async () => {
    await writeFile(join(workDir, 'a.nes'), 'a')
    await writeFile(join(workDir, 'c.nes'), 'c')

    const plan: RenamePlan = {
      operations: [
        {
          from: join(workDir, 'nao-existe.nes'),
          to: join(workDir, 'b.nes'),
          identification: identification('nao-existe.nes', 'b.nes'),
        },
        ...planOf([
          ['a.nes', 'A (USA).nes'],
          ['c.nes', 'C (USA).nes'],
        ]).operations,
      ],
      skipped: [],
    }

    const result = await executePlan(plan, { journalDir })

    expect(result.failed).toHaveLength(1)
    expect(result.applied).toHaveLength(2)
    expect(await listFiles()).toEqual(['A (USA).nes', 'C (USA).nes'])
  })

  it('grava o journal de forma incremental, não só no fim', async () => {
    await writeFile(join(workDir, 'a.nes'), 'a')
    await writeFile(join(workDir, 'b.nes'), 'b')

    const journalDuringRun: string[] = []
    await executePlan(
      planOf([
        ['a.nes', 'A.nes'],
        ['b.nes', 'B.nes'],
      ]),
      {
        journalDir,
        journalName: 'lote.jsonl',
        // Leitura síncrona de propósito: `onProgress` é chamado sem await, então uma leitura
        // assíncrona aqui não teria terminado quando o lote acabasse.
        onProgress: () => {
          // Se o journal só fosse escrito no fim, aqui estaria vazio — e um crash no meio
          // do lote deixaria renomeações sem como desfazer.
          journalDuringRun.push(readFileSync(join(journalDir, 'lote.jsonl'), 'utf8'))
        },
      },
    )

    expect(journalDuringRun[0]?.trim().split('\n')).toHaveLength(1)
    expect(journalDuringRun[1]?.trim().split('\n')).toHaveLength(2)
  })

  it('cancelar devolve o resultado parcial em vez de lançar', async () => {
    await writeFile(join(workDir, 'a.nes'), 'a')
    await writeFile(join(workDir, 'b.nes'), 'b')

    const controller = new AbortController()
    const result = await executePlan(
      planOf([
        ['a.nes', 'A.nes'],
        ['b.nes', 'B.nes'],
      ]),
      { journalDir, signal: controller.signal, onProgress: () => controller.abort() },
    )

    // Quem cancelou precisa saber o que chegou a acontecer, e ter o journal para desfazer.
    expect(result.cancelled).toBe(true)
    expect(result.applied).toHaveLength(1)
    expect(result.journalPath).not.toBeNull()
    expect(await listFiles()).toEqual(['A.nes', 'b.nes'])
  })

  it('cancelar antes de começar não renomeia nada', async () => {
    await writeFile(join(workDir, 'a.nes'), 'a')

    const controller = new AbortController()
    controller.abort()

    const result = await executePlan(planOf([['a.nes', 'A.nes']]), {
      journalDir,
      signal: controller.signal,
    })

    expect(result.cancelled).toBe(true)
    expect(result.applied).toEqual([])
    expect(await listFiles()).toEqual(['a.nes'])
  })

  it('o que foi aplicado antes do cancelamento continua desfazível', async () => {
    await writeFile(join(workDir, 'a.nes'), 'a')
    await writeFile(join(workDir, 'b.nes'), 'b')

    const controller = new AbortController()
    const result = await executePlan(
      planOf([
        ['a.nes', 'A.nes'],
        ['b.nes', 'B.nes'],
      ]),
      { journalDir, signal: controller.signal, onProgress: () => controller.abort() },
    )

    await undoFromJournal(result.journalPath as string)
    expect(await listFiles()).toEqual(['a.nes', 'b.nes'])
  })
})

describe('undoFromJournal', () => {
  it('restaura os nomes originais', async () => {
    await writeFile(join(workDir, 'bagunca.nes'), 'conteudo')
    const result = await executePlan(planOf([['bagunca.nes', 'Jogo (USA).nes']]), { journalDir })

    const undo = await undoFromJournal(result.journalPath as string)

    expect(undo.failed).toEqual([])
    expect(undo.restored).toHaveLength(1)
    expect(await listFiles()).toEqual(['bagunca.nes'])
    expect(await readFile(join(workDir, 'bagunca.nes'), 'utf8')).toBe('conteudo')
  })

  it('desfaz na ordem inversa, para cadeias de rename não colidirem', async () => {
    await writeFile(join(workDir, 'a.nes'), 'A')
    await writeFile(join(workDir, 'b.nes'), 'B')

    // b libera o nome, depois a assume: desfazer na ordem original recolocaria b antes de a sair.
    const result = await executePlan(
      {
        operations: [
          ...planOf([['b.nes', 'c.nes']]).operations,
          ...planOf([['a.nes', 'b.nes']]).operations,
        ],
        skipped: [],
      },
      { journalDir },
    )
    expect(await listFiles()).toEqual(['b.nes', 'c.nes'])

    const undo = await undoFromJournal(result.journalPath as string)

    expect(undo.failed).toEqual([])
    expect(await listFiles()).toEqual(['a.nes', 'b.nes'])
    expect(await readFile(join(workDir, 'a.nes'), 'utf8')).toBe('A')
    expect(await readFile(join(workDir, 'b.nes'), 'utf8')).toBe('B')
  })

  it('desfaz também o rename que só mudou a caixa', async () => {
    await writeFile(join(workDir, 'MARIO.NES'), 'conteudo')
    const result = await executePlan(planOf([['MARIO.NES', 'Mario.nes']]), { journalDir })

    await undoFromJournal(result.journalPath as string)
    expect(await listFiles()).toEqual(['MARIO.NES'])
  })

  it('reporta o que não deu para restaurar, sem abortar o resto', async () => {
    await writeFile(join(workDir, 'a.nes'), 'A')
    await writeFile(join(workDir, 'b.nes'), 'B')
    const result = await executePlan(
      planOf([
        ['a.nes', 'A.nes'],
        ['b.nes', 'B.nes'],
      ]),
      { journalDir },
    )

    // O usuário mexeu na pasta entre a execução e o undo.
    await rm(join(workDir, 'A.nes'))

    const undo = await undoFromJournal(result.journalPath as string)

    expect(undo.restored).toHaveLength(1)
    expect(undo.failed).toHaveLength(1)
    expect(await listFiles()).toEqual(['b.nes'])
  })

  it('não sobrescreve um arquivo que ocupou o nome original', async () => {
    await writeFile(join(workDir, 'a.nes'), 'ORIGINAL')
    const result = await executePlan(planOf([['a.nes', 'A (USA).nes']]), { journalDir })

    await writeFile(join(workDir, 'a.nes'), 'INTRUSO')

    const undo = await undoFromJournal(result.journalPath as string)

    expect(undo.failed).toHaveLength(1)
    expect(await readFile(join(workDir, 'a.nes'), 'utf8')).toBe('INTRUSO')
    expect(await readFile(join(workDir, 'A (USA).nes'), 'utf8')).toBe('ORIGINAL')
  })
})
