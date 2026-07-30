import type { IdentificationMethod, SkipReason } from '@romorg/core'

/**
 * Formas enxutas trafegadas pelo IPC.
 *
 * O `Identification` completo carrega o rule pack inteiro e todos os candidatos do DAT; numa
 * coleção de 10 mil arquivos isso é megabytes atravessando a ponte por scan. Estes DTOs levam
 * só o que a tabela mostra — o objeto completo fica no main, que é quem vai executar.
 */
export interface ScanRow {
  /** Identidade estável da linha, incluindo a entrada quando vem de um zip. */
  id: string
  fileName: string
  archiveEntry: string | null
  method: IdentificationMethod
  proposedName: string | null
  ambiguous: boolean
  /** Nomes de jogo que os DATs propuseram — mais de um quer dizer que discordam. */
  candidates: string[]
  /** Identificado pelo CRC que o zip já guarda, sem descomprimir. */
  fromArchiveIndex: boolean
  /** Foi preciso descontar o header para o hash bater. */
  headerStripped: boolean
  /** Variante de byte order normalizada, quando houve. */
  byteOrderVariant: string | null
}

export interface ScanSummaryDto {
  libraryId: string
  rows: ScanRow[]
  failures: { filePath: string; reason: string }[]
  /** Veio de um scan anterior, não de uma identificação feita agora. */
  restored?: boolean
  /** Arquivos do snapshot sumiram do disco: a lista pode estar defasada. */
  stale?: boolean
}

export interface PlanRow {
  id: string
  from: string
  to: string
  /** Verdadeiro quando a operação é mover para a quarentena, não renomear. */
  quarantine: boolean
}

export interface SkippedRow {
  id: string
  fileName: string
  reason: SkipReason
  detail: string | null
}

export interface PlanDto {
  operations: PlanRow[]
  skipped: SkippedRow[]
}

export interface PlanOptionsDto {
  includeFilenameMatches: boolean
  allowAmbiguous: boolean
  /** Vazio significa: usar o padrão do rule pack, ou o nome canônico do DAT. */
  template: string
  /** Pasta para onde vão os não identificados. Vazio desliga o recurso. */
  quarantineDirectory: string
}

/**
 * O plano vem com as linhas já recalculadas.
 *
 * Trocar o padrão de nomes muda o que a tabela mostra e o que o plano fará ao mesmo tempo —
 * devolver os dois juntos evita que a tela fique com um nome proposto e o plano com outro.
 */
export interface PlanResultDto {
  plan: PlanDto
  rows: ScanRow[]
}

export interface ApplyResultDto {
  applied: number
  failed: { from: string; reason: string }[]
  journalPath: string | null
  /** O usuário recusou a confirmação — não é erro, e a interface não deve reportar como tal. */
  cancelled: boolean
}

export interface JournalSummary {
  path: string
  fileName: string
  operations: number
  at: string
}

export interface UndoResultDto {
  restored: number
  failed: { from: string; reason: string }[]
}

export interface ApplyProgress {
  libraryId: string
  done: number
  total: number
  currentFile: string
}

export interface AuditOptionsDto {
  regions: string[]
  includeUnreleased: boolean
  datSource: string | null
}

export interface AuditRow {
  gameName: string
  regions: string[]
  status: 'have' | 'missing'
  datSource: string
  filePath: string | null
}

export interface AuditReportDto {
  total: number
  have: number
  missing: number
  completion: number
  games: AuditRow[]
  duplicates: { gameName: string; filePaths: string[] }[]
  unrecognized: { fileName: string; filePath: string }[]
  datSources: string[]
  /** Todas as regiões vistas, para montar o filtro sem outra chamada. */
  availableRegions: string[]
}

export interface PlaylistPlanDto {
  m3u: { fileName: string; discs: string[]; exists: boolean }[]
  lpl: { fileName: string; items: number; exists: boolean }
}

export interface ScanProgress {
  libraryId: string
  done: number
  total: number
  currentFile: string
}
