import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SystemRulePack } from '@romorg/core'

const RAW_BASE =
  'https://raw.githubusercontent.com/libretro/retroarch-assets/master/xmb/monochrome/png'

/**
 * Ícones de console, do repositório de assets do RetroArch.
 *
 * O mesmo `libretroDat` que nomeia o DAT nomeia o ícone, então um rule pack novo ganha ícone
 * sem configuração extra. São PNGs monocromáticos sob CC BY 4.0 — baixados sob demanda e
 * guardados em cache, nunca redistribuídos com o app.
 */
export class IconCache {
  private readonly directory: string
  private readonly memory = new Map<string, string | null>()

  constructor(directory: string) {
    this.directory = directory
  }

  private fileFor(systemId: string): string {
    return join(this.directory, `${systemId}.png`)
  }

  /**
   * Ícone como data URI, ou `null` quando não há.
   *
   * Data URI porque a política de segurança da janela bloqueia carregar arquivo do disco no
   * renderer, e abrir uma exceção para isso custaria mais do que os poucos KB de base64.
   */
  async getFor(system: SystemRulePack): Promise<string | null> {
    const cached = this.memory.get(system.id)
    if (cached !== undefined) return cached

    const resolved = await this.load(system)
    this.memory.set(system.id, resolved)
    return resolved
  }

  private async load(system: SystemRulePack): Promise<string | null> {
    const path = this.fileFor(system.id)

    try {
      return toDataUri(await readFile(path))
    } catch {
      // Ainda não baixado.
    }

    if (system.libretroDat === undefined) return null

    try {
      const response = await fetch(`${RAW_BASE}/${encodeURIComponent(system.libretroDat)}.png`)
      if (!response.ok) return null

      const bytes = Buffer.from(await response.arrayBuffer())
      await mkdir(this.directory, { recursive: true })
      await writeFile(path, bytes)
      return toDataUri(bytes)
    } catch {
      // Sem rede: a interface funciona sem ícone, então isto não é erro que valha interromper.
      return null
    }
  }
}

function toDataUri(bytes: Buffer): string {
  return `data:image/png;base64,${bytes.toString('base64')}`
}
