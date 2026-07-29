#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DatIndex,
  fetchLibretroDatsFor,
  loadRulePacksFrom,
  parseDat,
  executePlan,
  planRenames,
  scanDirectory,
  SystemRegistry,
  undoFromJournal,
  type Identification,
  type SkipReason,
} from '@romorg/core'

const RULE_PACKS_DIR = fileURLToPath(new URL('../../../data/systems', import.meta.url))

/** Rótulos curtos e alinhados, para a tabela do scan ficar legível no terminal. */
const METHOD_LABEL: Record<Identification['method'], string> = {
  hash: 'hash',
  'hash-headerless': 'hash (sem header)',
  filename: 'nome',
  unidentified: '—',
}

const SKIP_LABEL: Record<SkipReason, string> = {
  'already-named': 'já com o nome certo',
  'no-proposal': 'sem nome a propor',
  ambiguous: 'DATs discordam',
  collision: 'destino já existe',
  'duplicate-target': 'dois arquivos, mesmo destino',
}

async function loadRegistry(): Promise<SystemRegistry> {
  return new SystemRegistry(await loadRulePacksFrom(RULE_PACKS_DIR))
}

async function listSystems(): Promise<void> {
  const registry = await loadRegistry()
  for (const system of registry.all()) {
    const flags = [system.header ? 'header' : null, system.byteOrder ? 'byte-order' : null].filter(
      Boolean,
    )
    const suffix = flags.length > 0 ? `  [${flags.join(', ')}]` : ''
    console.log(`${system.id.padEnd(16)} ${system.name}${suffix}`)
  }
}

interface ScanArgs {
  directory: string
  systemId: string
  datPaths: string[]
  recursive: boolean
  libretro: boolean
  apply: boolean
  includeFilenameMatches: boolean
}

function parseScanArgs(argv: string[]): ScanArgs | string {
  const positional: string[] = []
  const datPaths: string[] = []
  let systemId: string | undefined
  let recursive = false
  let libretro = false
  let apply = false
  let includeFilenameMatches = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string
    if (arg === '--system' || arg === '-s') {
      systemId = argv[++i]
    } else if (arg === '--dat' || arg === '-d') {
      const value = argv[++i]
      if (value !== undefined) datPaths.push(value)
    } else if (arg === '--libretro' || arg === '-l') {
      libretro = true
    } else if (arg === '--apply') {
      apply = true
    } else if (arg === '--include-filename-matches') {
      includeFilenameMatches = true
    } else if (arg === '--recursive' || arg === '-r') {
      recursive = true
    } else if (arg.startsWith('-')) {
      return `opção desconhecida: ${arg}`
    } else {
      positional.push(arg)
    }
  }

  const directory = positional[0]
  if (directory === undefined) return 'informe a pasta a escanear'
  if (systemId === undefined) return 'informe o sistema com --system (veja `romorg systems`)'

  return { directory, systemId, datPaths, recursive, libretro, apply, includeFilenameMatches }
}

async function scan(argv: string[]): Promise<number> {
  const args = parseScanArgs(argv)
  if (typeof args === 'string') {
    console.error(`erro: ${args}`)
    return 1
  }

  const registry = await loadRegistry()
  const system = registry.get(args.systemId)
  if (system === undefined) {
    console.error(`erro: sistema desconhecido "${args.systemId}" (veja \`romorg systems\`)`)
    return 1
  }

  const index = new DatIndex()
  try {
    if (args.libretro) {
      console.log('Baixando DATs do libretro-database…')
      const { parsed, missing } = await fetchLibretroDatsFor(system)
      for (const dat of parsed) {
        console.log(`  ${dat.name} (${index.importDat(dat)} entradas)`)
      }
      for (const ref of missing) {
        console.log(`  ${ref.name}: sem versão "${ref.collection}"`)
      }
    }

    for (const datPath of args.datPaths) {
      const parsed = parseDat(await readFile(datPath, 'utf8'))
      const count = index.importDat(parsed)
      console.log(`DAT carregado: ${parsed.name} (${count} entradas)`)
    }

    if (!args.libretro && args.datPaths.length === 0) {
      console.log('Sem DAT (use --libretro ou --dat): a identificação usará só o nome do arquivo.')
    }
    console.log('')

    const { results, failures } = await scanDirectory(args.directory, system, index, {
      recursive: args.recursive,
    })

    const counts: Record<Identification['method'], number> = {
      hash: 0,
      'hash-headerless': 0,
      filename: 0,
      unidentified: 0,
    }

    let fromArchiveIndex = 0

    for (const result of results) {
      counts[result.method] += 1
      if (result.fromArchiveIndex === true) fromArchiveIndex += 1

      const target = result.proposedName ?? '(sem proposta)'
      const arrow = result.proposedName === result.fileName ? '=' : '→'
      const source =
        result.archiveEntry !== undefined
          ? `${result.fileName} › ${result.archiveEntry}`
          : result.fileName
      const ambiguity = result.ambiguous ? `  ⚠ ${result.matches.length} candidatos` : ''
      console.log(
        `${METHOD_LABEL[result.method].padEnd(18)} ${source} ${arrow} ${target}${ambiguity}`,
      )
    }

    for (const failure of failures) {
      console.error(`falha: ${failure.filePath} — ${failure.reason}`)
    }

    const identified = counts.hash + counts['hash-headerless']
    console.log(
      [
        '',
        `Arquivos: ${results.length}`,
        `  por hash:        ${counts.hash}`,
        `  por hash s/ hdr: ${counts['hash-headerless']}`,
        `  por nome:        ${counts.filename}`,
        `  não identificados: ${counts.unidentified}`,
        fromArchiveIndex > 0 ? `  (${fromArchiveIndex} via CRC do zip, sem descomprimir)` : '',
        results.length > 0
          ? `Taxa de identificação por hash: ${((identified / results.length) * 100).toFixed(1)}%`
          : '',
      ]
        .filter((line) => line !== '')
        .join('\n'),
    )

    const plan = planRenames(results, {
      includeFilenameMatches: args.includeFilenameMatches,
      existingPaths: results.map((result) => result.filePath),
    })

    console.log(`\nA renomear: ${plan.operations.length}`)
    for (const operation of plan.operations) {
      console.log(`  ${basename(operation.from)} → ${basename(operation.to)}`)
    }

    const skipCounts = new Map<string, number>()
    for (const entry of plan.skipped) {
      skipCounts.set(entry.reason, (skipCounts.get(entry.reason) ?? 0) + 1)
    }
    if (skipCounts.size > 0) {
      console.log('Fora do plano:')
      for (const [reason, count] of [...skipCounts].sort()) {
        console.log(`  ${SKIP_LABEL[reason as SkipReason].padEnd(28)} ${count}`)
      }
    }

    if (!args.apply) {
      console.log('\nDry-run: nada foi alterado. Use --apply para executar.')
      return 0
    }

    if (plan.operations.length === 0) return 0

    const execution = await executePlan(plan, { journalDir: journalDirFor(args.directory) })
    console.log(`\nRenomeados: ${execution.applied.length}`)
    for (const failure of execution.failed) {
      console.error(`  falhou: ${basename(failure.from)} — ${failure.reason}`)
    }
    if (execution.journalPath !== null) {
      console.log(`Journal: ${execution.journalPath}`)
      console.log(`Para desfazer:  romorg undo "${execution.journalPath}"`)
    }

    return execution.failed.length > 0 ? 1 : 0
  } finally {
    index.close()
  }
}

/** O journal fica junto da coleção: quem move a pasta leva o histórico de undo junto. */
function journalDirFor(directory: string): string {
  return join(directory, '.romorg', 'journal')
}

async function undo(argv: string[]): Promise<number> {
  const journalPath = argv[0]
  if (journalPath === undefined) {
    console.error('erro: informe o caminho do journal')
    return 1
  }

  const result = await undoFromJournal(journalPath)
  console.log(`Restaurados: ${result.restored.length}`)
  for (const failure of result.failed) {
    console.error(`  falhou: ${basename(failure.from)} — ${failure.reason}`)
  }
  return result.failed.length > 0 ? 1 : 0
}

function printUsage(): void {
  console.log(
    [
      'romorg — organizador de coleções de ROMs locais',
      '',
      'Uso:',
      '  romorg systems',
      '      Lista os sistemas suportados.',
      '',
      '  romorg scan <pasta> --system <id> [opções]',
      '      Identifica os arquivos da pasta e mostra o nome proposto para cada um.',
      '      Lê ROMs soltas e dentro de .zip. Não altera nada em disco.',
      '',
      '      --libretro, -l    Baixa os DATs do libretro-database para o sistema.',
      '      --dat, -d <arq>   Usa um DAT local (No-Intro/Redump). Pode repetir.',
      '      --recursive, -r   Desce nas subpastas.',
      '      --apply           Executa o plano. Sem isto, nada é alterado.',
      '      --include-filename-matches',
      '                        Renomeia também o que foi identificado só pelo nome.',
      '',
      '  romorg undo <journal.jsonl>',
      '      Desfaz um lote aplicado, usando o journal que ele gravou.',
      '',
      'Exemplos:',
      '  romorg scan ~/roms/snes --system snes --libretro',
      '  romorg scan ~/roms/snes --system snes --libretro --apply',
      '  romorg undo ~/roms/snes/.romorg/journal/2026-07-29T10-00-00-000Z.jsonl',
    ].join('\n'),
  )
}

const [command, ...rest] = process.argv.slice(2)

if (command === 'systems') {
  await listSystems()
} else if (command === 'scan') {
  process.exitCode = await scan(rest)
} else if (command === 'undo') {
  process.exitCode = await undo(rest)
} else {
  printUsage()
  process.exitCode = command === undefined ? 0 : 1
}
