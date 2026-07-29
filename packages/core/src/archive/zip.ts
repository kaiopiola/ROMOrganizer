import type { Readable } from 'node:stream'
import yauzl, { type Entry, type ZipFile } from 'yauzl'

/**
 * Leitura de `.zip` — o formato em que a maioria das coleções vive.
 *
 * O ponto que muda o custo de um scan: **o próprio ZIP guarda o CRC32 do conteúdo
 * descomprimido** em cada entrada. Para a maioria dos arquivos isso basta para identificar o
 * jogo, e o índice responde sem descomprimir um único byte. A descompressão só é necessária
 * quando esse CRC não casa e o sistema tem header ou byte order a normalizar.
 */
export interface ZipEntry {
  /** Caminho da entrada dentro do zip. */
  name: string
  /** Tamanho do conteúdo descomprimido. */
  size: number
  /** CRC32 do conteúdo descomprimido, em hex minúsculo — vem do próprio zip. */
  crc32: string
}

export class ZipError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'ZipError'
  }
}

function openZip(path: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (error, zipFile) => {
      if (error) reject(new ZipError(`não foi possível abrir ${path}`, { cause: error }))
      else resolve(zipFile)
    })
  })
}

function isDirectoryEntry(entry: Entry): boolean {
  return entry.fileName.endsWith('/')
}

/**
 * Lista as entradas de arquivo do zip, já com o CRC32 que o formato armazena.
 *
 * Diretórios ficam de fora, e o zip é fechado ao final — nada de handle vazando num scan de
 * milhares de arquivos.
 */
export async function listZipEntries(path: string): Promise<ZipEntry[]> {
  const zipFile = await openZip(path)
  const entries: ZipEntry[] = []

  try {
    await new Promise<void>((resolve, reject) => {
      zipFile.on('entry', (entry: Entry) => {
        if (!isDirectoryEntry(entry)) {
          entries.push({
            name: entry.fileName,
            size: entry.uncompressedSize,
            crc32: (entry.crc32 >>> 0).toString(16).padStart(8, '0'),
          })
        }
        zipFile.readEntry()
      })
      zipFile.on('end', resolve)
      zipFile.on('error', (error: unknown) =>
        reject(new ZipError(`erro lendo ${path}`, { cause: error })),
      )
      zipFile.readEntry()
    })
  } finally {
    zipFile.close()
  }

  return entries
}

/**
 * Abre o conteúdo descomprimido de uma entrada como stream.
 *
 * Streaming em vez de extrair para disco: uma coleção zipada não deve exigir espaço livre
 * equivalente à própria coleção só para ser identificada.
 */
export async function openZipEntry(
  path: string,
  entryName: string,
): Promise<AsyncIterable<Uint8Array>> {
  const zipFile = await openZip(path)

  const entry = await new Promise<Entry>((resolve, reject) => {
    zipFile.on('entry', (candidate: Entry) => {
      if (candidate.fileName === entryName) resolve(candidate)
      else zipFile.readEntry()
    })
    zipFile.on('end', () =>
      reject(new ZipError(`entrada "${entryName}" não encontrada em ${path}`)),
    )
    zipFile.on('error', (error: unknown) =>
      reject(new ZipError(`erro lendo ${path}`, { cause: error })),
    )
    zipFile.readEntry()
  }).catch((error: unknown) => {
    zipFile.close()
    throw error
  })

  const stream = await new Promise<Readable>((resolve, reject) => {
    zipFile.openReadStream(entry, (error, readStream) => {
      if (error) reject(new ZipError(`erro abrindo "${entryName}"`, { cause: error }))
      else resolve(readStream)
    })
  }).catch((error: unknown) => {
    zipFile.close()
    throw error
  })

  return {
    async *[Symbol.asyncIterator]() {
      try {
        yield* stream
      } finally {
        zipFile.close()
      }
    },
  }
}

/** Verdadeiro para caminhos que devem ser tratados como arquivo compactado. */
export function isZipPath(path: string): boolean {
  return path.toLowerCase().endsWith('.zip')
}
