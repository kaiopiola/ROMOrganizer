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
}

export interface PlanRow {
  id: string
  from: string
  to: string
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

export interface ScanProgress {
  libraryId: string
  done: number
  total: number
  currentFile: string
}
