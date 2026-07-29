#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  DatIndex,
  loadRulePacksFrom,
  parseLogiqxDat,
  scanDirectory,
  SystemRegistry,
  type Identification,
} from '@romorg/core'

const RULE_PACKS_DIR = fileURLToPath(new URL('../../../data/systems', import.meta.url))

/** Rótulos curtos e alinhados, para a tabela do scan ficar legível no terminal. */
const METHOD_LABEL: Record<Identification['method'], string> = {
  hash: 'hash',
  'hash-headerless': 'hash (sem header)',
  filename: 'nome',
  unidentified: '—',
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
}

function parseScanArgs(argv: string[]): ScanArgs | string {
  const positional: string[] = []
  const datPaths: string[] = []
  let systemId: string | undefined
  let recursive = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string
    if (arg === '--system' || arg === '-s') {
      systemId = argv[++i]
    } else if (arg === '--dat' || arg === '-d') {
      const value = argv[++i]
      if (value !== undefined) datPaths.push(value)
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

  return { directory, systemId, datPaths, recursive }
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
    for (const datPath of args.datPaths) {
      const parsed = parseLogiqxDat(await readFile(datPath, 'utf8'))
      const count = index.importDat(parsed)
      console.log(`DAT carregado: ${parsed.name} (${count} entradas)`)
    }
    if (args.datPaths.length === 0) {
      console.log('Nenhum DAT informado (--dat): a identificação usará só o nome do arquivo.\n')
    }

    const { results, failures } = await scanDirectory(args.directory, system, index, {
      recursive: args.recursive,
    })

    const counts: Record<Identification['method'], number> = {
      hash: 0,
      'hash-headerless': 0,
      filename: 0,
      unidentified: 0,
    }

    for (const result of results) {
      counts[result.method] += 1
      const target = result.proposedName ?? '(sem proposta)'
      const unchanged = result.proposedName === result.fileName
      const arrow = unchanged ? '=' : '→'
      const ambiguity = result.ambiguous ? `  ⚠ ${result.matches.length} candidatos` : ''
      console.log(
        `${METHOD_LABEL[result.method].padEnd(18)} ${result.fileName} ${arrow} ${target}${ambiguity}`,
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
        results.length > 0
          ? `Taxa de identificação por hash: ${((identified / results.length) * 100).toFixed(1)}%`
          : '',
      ].join('\n'),
    )

    return 0
  } finally {
    index.close()
  }
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
      '  romorg scan <pasta> --system <id> [--dat <arquivo.dat>]... [--recursive]',
      '      Identifica os arquivos da pasta e mostra o nome proposto para cada um.',
      '      Não altera nada em disco.',
      '',
      'Exemplo:',
      '  romorg scan ~/roms/snes --system snes --dat snes.dat',
    ].join('\n'),
  )
}

const [command, ...rest] = process.argv.slice(2)

if (command === 'systems') {
  await listSystems()
} else if (command === 'scan') {
  process.exitCode = await scan(rest)
} else {
  printUsage()
  process.exitCode = command === undefined ? 0 : 1
}
