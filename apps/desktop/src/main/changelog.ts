import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

export interface ChangelogEntry {
  version: string
  /** Conteúdo em Markdown, no idioma pedido ou no inglês como reserva. */
  body: string
}

/**
 * Notas de versão, do repositório em desenvolvimento e de `resources/` no app empacotado.
 *
 * Elas viajam com o app em vez de serem buscadas do GitHub porque ler o que mudou não deveria
 * exigir internet — e porque a versão instalada precisa mostrar as notas *dela*, não as da
 * última publicada.
 */
function changelogDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'changelog')
    : fileURLToPath(new URL('../../../../changelog', import.meta.url))
}

/** Ordena da versão mais nova para a mais antiga. */
function compareVersionsDesc(left: string, right: string): number {
  const parse = (value: string): number[] => value.split('.').map((part) => Number(part) || 0)
  const [a, b] = [parse(left), parse(right)]

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (b[i] ?? 0) - (a[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export async function readChangelog(language: string): Promise<ChangelogEntry[]> {
  const directory = changelogDirectory()

  let files: string[]
  try {
    files = await readdir(directory)
  } catch {
    return []
  }

  const versions = [
    ...new Set(
      files
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.replace(/\.(en|pt-BR)\.md$/, '')),
    ),
  ].sort(compareVersionsDesc)

  const entries = await Promise.all(
    versions.map(async (version) => {
      // Inglês é a reserva: uma versão pode não ter tradução, e ficar sem notas seria pior.
      const candidates =
        language === 'pt-BR'
          ? [`${version}.pt-BR.md`, `${version}.en.md`]
          : [`${version}.en.md`, `${version}.pt-BR.md`]

      for (const candidate of candidates) {
        try {
          return { version, body: await readFile(join(directory, candidate), 'utf8') }
        } catch {
          continue
        }
      }
      return null
    }),
  )

  return entries.filter((entry): entry is ChangelogEntry => entry !== null)
}
