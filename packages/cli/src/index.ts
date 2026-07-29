#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { loadRulePacksFrom, SystemRegistry } from '@romorg/core'

const RULE_PACKS_DIR = fileURLToPath(new URL('../../../data/systems', import.meta.url))

async function listSystems(): Promise<void> {
  const registry = new SystemRegistry(await loadRulePacksFrom(RULE_PACKS_DIR))
  for (const system of registry.all()) {
    const flags = [system.header ? 'header' : null, system.byteOrder ? 'byte-order' : null].filter(
      Boolean,
    )
    const suffix = flags.length > 0 ? `  [${flags.join(', ')}]` : ''
    console.log(`${system.id.padEnd(16)} ${system.name}${suffix}`)
  }
}

function printUsage(): void {
  console.log(
    [
      'romorg — organizador de coleções de ROMs locais',
      '',
      'Uso:',
      '  romorg systems    lista os sistemas suportados',
      '',
      'O comando `scan` chega na Fase 1.',
    ].join('\n'),
  )
}

const command = process.argv[2]

if (command === 'systems') {
  await listSystems()
} else {
  printUsage()
  process.exitCode = command === undefined ? 0 : 1
}
