import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Uma pasta vinculada a um console — o modelo mental da ferramenta: o usuário aponta onde
 * ficam as ROMs de cada sistema e a partir daí tudo é por biblioteca.
 */
export interface Library {
  id: string
  systemId: string
  directory: string
  recursive: boolean
  /** Padrão de nomes desta biblioteca. Vazio significa usar o do rule pack. */
  template?: string
  /** Pasta de quarentena, relativa à raiz. Vazio ou ausente desliga o recurso. */
  quarantineDirectory?: string
}

/** Campos editáveis de uma biblioteca. */
export type LibraryChanges = Partial<Omit<Library, 'id'>>

interface LibrariesFile {
  version: 1
  libraries: Library[]
}

const EMPTY: LibrariesFile = { version: 1, libraries: [] }

/**
 * Persistência das bibliotecas em JSON.
 *
 * A escrita é atômica (arquivo temporário + rename) porque este arquivo é a única memória do
 * que o usuário configurou: um desligamento no meio da gravação não pode deixá-lo truncado.
 */
export class LibraryStore {
  private readonly filePath: string
  private cache: LibrariesFile | null = null

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async load(): Promise<LibrariesFile> {
    if (this.cache !== null) return this.cache

    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as LibrariesFile
      this.cache = Array.isArray(parsed.libraries) ? parsed : EMPTY
    } catch {
      // Arquivo ausente na primeira execução, ou corrompido: começar vazio é melhor que
      // impedir o app de abrir.
      this.cache = EMPTY
    }
    return this.cache
  }

  private async save(data: LibrariesFile): Promise<void> {
    this.cache = data
    await mkdir(dirname(this.filePath), { recursive: true })

    const temporary = `${this.filePath}.tmp`
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    const { rename } = await import('node:fs/promises')
    await rename(temporary, this.filePath)
  }

  async list(): Promise<Library[]> {
    return (await this.load()).libraries
  }

  async get(id: string): Promise<Library | undefined> {
    return (await this.list()).find((library) => library.id === id)
  }

  /** Vincular a mesma pasta ao mesmo sistema duas vezes devolve a biblioteca existente. */
  async add(systemId: string, directory: string, recursive = false): Promise<Library> {
    const data = await this.load()

    const existing = data.libraries.find(
      (library) => library.directory === directory && library.systemId === systemId,
    )
    if (existing !== undefined) return existing

    const library: Library = { id: randomUUID(), systemId, directory, recursive }
    await this.save({ ...data, libraries: [...data.libraries, library] })
    return library
  }

  async update(id: string, changes: LibraryChanges): Promise<Library | undefined> {
    const data = await this.load()
    const updated = data.libraries.map((library) =>
      library.id === id ? { ...library, ...changes } : library,
    )
    await this.save({ ...data, libraries: updated })
    return updated.find((library) => library.id === id)
  }

  async remove(id: string): Promise<void> {
    const data = await this.load()
    await this.save({
      ...data,
      libraries: data.libraries.filter((library) => library.id !== id),
    })
  }
}

/** Cache e journal ficam junto da coleção: quem move a pasta leva os dois consigo. */
export function hashCachePathFor(library: Library): string {
  return join(library.directory, '.romorg', 'hashes.json')
}

/** O journal fica junto da coleção: quem move a pasta leva o histórico de undo junto. */
export function journalDirFor(library: Library): string {
  return join(library.directory, '.romorg', 'journal')
}
