import type { AuditReport } from './audit.ts'

/** Escapa um campo de CSV conforme RFC 4180. Nomes de jogo têm vírgula e aspas com frequência. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Relatório em CSV.
 *
 * Uma linha por jogo do DAT, com o status — é o formato que entra em planilha, que é onde as
 * pessoas de fato cruzam listas de coleção.
 */
export function auditToCsv(report: AuditReport): string {
  const header = ['status', 'game', 'regions', 'languages', 'dat', 'path']

  const rows = report.games.map((game) =>
    [
      game.status,
      game.gameName,
      game.regions.join(' '),
      game.languages.join(' '),
      game.datSource,
      game.filePath ?? '',
    ]
      .map(csvField)
      .join(','),
  )

  return [header.join(','), ...rows].join('\n')
}

/** Relatório em Markdown, para colar em issue ou fórum. */
export function auditToMarkdown(report: AuditReport, title = 'Auditoria'): string {
  const lines: string[] = [
    `# ${title}`,
    '',
    `- Jogos no DAT: **${report.total}**`,
    `- Presentes: **${report.have}**`,
    `- Faltando: **${report.missing}**`,
    `- Completude: **${report.completion.toFixed(1)}%**`,
    '',
  ]

  if (report.datSources.length > 0) {
    lines.push(`Bases: ${report.datSources.join(', ')}`, '')
  }

  const missing = report.games.filter((game) => game.status === 'missing')
  if (missing.length > 0) {
    lines.push(`## Faltando (${missing.length})`, '')
    for (const game of missing) lines.push(`- ${game.gameName}`)
    lines.push('')
  }

  if (report.duplicates.length > 0) {
    lines.push(`## Duplicados (${report.duplicates.length})`, '')
    for (const duplicate of report.duplicates) {
      lines.push(`- ${duplicate.gameName}`)
      for (const path of duplicate.filePaths) lines.push(`  - \`${path}\``)
    }
    lines.push('')
  }

  if (report.unrecognized.length > 0) {
    lines.push(`## Não reconhecidos (${report.unrecognized.length})`, '')
    for (const entry of report.unrecognized) lines.push(`- ${entry.fileName}`)
    lines.push('')
  }

  return lines.join('\n')
}
