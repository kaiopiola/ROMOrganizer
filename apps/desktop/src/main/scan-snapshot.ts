import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Identification, SystemRegistry } from '@romorg/core'

/**
 * Identificação sem o rule pack.
 *
 * O `system` é o mesmo objeto para todas as linhas e vem do registry — gravá-lo por arquivo
 * multiplicaria o tamanho do snapshot por nada.
 */
type StoredIdentification = Omit<Identification, 'system'> & { systemId: string }

interface SnapshotFile {
  version: 1
  savedAt: string
  identifications: StoredIdentification[]
}

/**
 * Último resultado de identificação, guardado junto da coleção.
 *
 * Sem isto, abrir uma biblioteca já escaneada mostra uma tela vazia até o usuário mandar
 * identificar de novo — mesmo que nada tenha mudado. O snapshot é conveniência de exibição:
 * ele é **revalidado contra o disco** ao ser carregado, e o que não confere é descartado.
 */
export class ScanSnapshot {
  /**
   * Grava o resultado. Não falha o scan se a gravação der errado — é cache de exibição, e
   * perdê-lo custa um rescan, não correção.
   */
  static async save(filePath: string, identifications: Identification[]): Promise<void> {
    const data: SnapshotFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      identifications: identifications.map(({ system, ...rest }) => ({
        ...rest,
        systemId: system.id,
      })),
    }

    try {
      await mkdir(dirname(filePath), { recursive: true })
      const temporary = `${filePath}.tmp`
      await writeFile(temporary, JSON.stringify(data), 'utf8')
      await rename(temporary, filePath)
    } catch {
      // Sem permissão de escrita na pasta da coleção, por exemplo.
    }
  }

  /**
   * Carrega e revalida.
   *
   * Cada arquivo do snapshot precisa ainda existir em disco. Entradas de arquivos removidos ou
   * renomeados por fora somem — mostrar um plano sobre arquivos que não estão mais lá levaria o
   * usuário a aprovar operações que só falhariam.
   */
  static async load(
    filePath: string,
    registry: SystemRegistry,
  ): Promise<{ identifications: Identification[]; savedAt: string; stale: boolean } | null> {
    let parsed: SnapshotFile
    try {
      parsed = JSON.parse(await readFile(filePath, 'utf8')) as SnapshotFile
    } catch {
      return null
    }

    if (parsed.version !== 1 || !Array.isArray(parsed.identifications)) return null

    const identifications: Identification[] = []
    let dropped = 0

    // Um `stat` por arquivo: barato perto de rehashear, e é o que separa "a lista que você
    // viu" de "a lista que ainda corresponde ao disco".
    await Promise.all(
      parsed.identifications.map(async ({ systemId, ...rest }) => {
        const system = registry.get(systemId)
        if (system === undefined) {
          dropped += 1
          return
        }

        try {
          await stat(rest.filePath)
        } catch {
          dropped += 1
          return
        }

        identifications.push({ ...rest, system } as Identification)
      }),
    )

    if (identifications.length === 0) return null

    // A ordem do snapshot é a ordem em que o scan encontrou os arquivos; `Promise.all` não a
    // preserva, então ela é restaurada aqui.
    identifications.sort((left, right) => left.filePath.localeCompare(right.filePath))

    return { identifications, savedAt: parsed.savedAt, stale: dropped > 0 }
  }
}
