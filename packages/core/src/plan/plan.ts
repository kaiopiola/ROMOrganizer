import { dirname, join } from 'node:path'
import type { Identification } from '../identify/identify.ts'

/** Uma renomeação a executar. Caminhos absolutos, resolvidos no momento do planejamento. */
export interface PlannedOperation {
  from: string
  to: string
  identification: Identification
}

/**
 * Por que um arquivo ficou de fora do plano.
 *
 * Ficar de fora não é falha — é a resposta correta quando aplicar seria adivinhação. Cada
 * motivo aparece na interface para o usuário poder decidir caso a caso.
 */
export type SkipReason =
  /** O arquivo já tem o nome proposto. */
  | 'already-named'
  /** Não houve match nem convenção reconhecível: não há nome a propor. */
  | 'no-proposal'
  /** Mais de um DAT reivindica este hash com nomes diferentes. */
  | 'ambiguous'
  /** Já existe outro arquivo com o nome de destino. */
  | 'collision'
  /** Dois arquivos do lote apontam para o mesmo destino. */
  | 'duplicate-target'

export interface SkippedFile {
  identification: Identification
  reason: SkipReason
  /** Contexto legível — o caminho conflitante, por exemplo. */
  detail?: string
}

export interface RenamePlan {
  operations: PlannedOperation[]
  skipped: SkippedFile[]
}

export interface PlanOptions {
  /**
   * Inclui no plano os arquivos identificados apenas pelo nome.
   *
   * Falso por padrão: renomear com base em heurística de nome é justamente o que faz as
   * ferramentas erradas estragarem coleções. Quem quiser assume a escolha explicitamente.
   */
  includeFilenameMatches?: boolean
  /** Aplica mesmo quando os DATs discordam, usando o primeiro candidato. */
  allowAmbiguous?: boolean
  /** Caminhos que já existem em disco, para detectar colisão sem tocar no filesystem. */
  existingPaths?: Iterable<string>
}

/** Duas rotas para o mesmo arquivo no mesmo diretório, ignorando caixa. */
function sameTargetKey(path: string): string {
  return path.toLowerCase()
}

/**
 * Monta o plano de renomeação a partir de um scan. **Não toca no disco.**
 *
 * Esta é a etapa de dry-run: o resultado é exatamente o que a execução fará, e é isso que o
 * usuário revisa antes de qualquer escrita.
 */
export function planRenames(
  identifications: readonly Identification[],
  options: PlanOptions = {},
): RenamePlan {
  const operations: PlannedOperation[] = []
  const skipped: SkippedFile[] = []

  const existing = new Set<string>()
  for (const path of options.existingPaths ?? []) existing.add(sameTargetKey(path))

  // Primeiro passe: decide o destino de cada arquivo isoladamente.
  const candidates: PlannedOperation[] = []
  for (const identification of identifications) {
    const { proposedName, fileName, filePath } = identification

    if (proposedName === null) {
      skipped.push({ identification, reason: 'no-proposal' })
      continue
    }
    if (proposedName === fileName) {
      skipped.push({ identification, reason: 'already-named' })
      continue
    }
    if (identification.ambiguous && options.allowAmbiguous !== true) {
      skipped.push({
        identification,
        reason: 'ambiguous',
        detail: identification.matches.map((match) => match.gameName).join(' | '),
      })
      continue
    }
    if (identification.method === 'filename' && options.includeFilenameMatches !== true) {
      skipped.push({ identification, reason: 'no-proposal' })
      continue
    }

    // `proposedName` pode conter `/` quando o template organiza em subpastas; `join`
    // resolve isso relativo à pasta onde o arquivo está hoje.
    candidates.push({ from: filePath, to: join(dirname(filePath), proposedName), identification })
  }

  // Segundo passe: conflitos só existem no conjunto, não no arquivo isolado.
  const targetCount = new Map<string, number>()
  for (const candidate of candidates) {
    const key = sameTargetKey(candidate.to)
    targetCount.set(key, (targetCount.get(key) ?? 0) + 1)
  }

  // Um arquivo que sai do lugar libera o próprio nome — não é colisão consigo mesmo.
  const vacated = new Set(candidates.map((candidate) => sameTargetKey(candidate.from)))

  for (const candidate of candidates) {
    const key = sameTargetKey(candidate.to)

    if ((targetCount.get(key) ?? 0) > 1) {
      skipped.push({
        identification: candidate.identification,
        reason: 'duplicate-target',
        detail: candidate.to,
      })
      continue
    }
    if (existing.has(key) && !vacated.has(key)) {
      skipped.push({
        identification: candidate.identification,
        reason: 'collision',
        detail: candidate.to,
      })
      continue
    }

    operations.push(candidate)
  }

  return { operations, skipped }
}

/** Renomeação que só muda a caixa das letras. Precisa de tratamento próprio ao executar. */
export function isCaseOnlyRename(from: string, to: string): boolean {
  return from !== to && from.toLowerCase() === to.toLowerCase()
}
