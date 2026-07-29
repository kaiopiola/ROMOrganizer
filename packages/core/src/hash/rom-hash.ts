import { createHash, type Hash } from 'node:crypto'
import { open } from 'node:fs/promises'
import { applyByteSwap } from '../rom/byte-order.ts'
import { concatBytes } from '../util/bytes.ts'
import { Crc32 } from './crc32.ts'

/** Os três hashes que os DATs Logiqx trazem, mais o tamanho do dump. */
export interface RomHashes {
  crc32: string
  md5: string
  sha1: string
  /** Bytes efetivamente hasheados. */
  size: number
}

export interface HashOptions {
  /** Bytes de header a descartar na variante `stripped`. */
  headerOffset?: number
  /** Normalização de byte order a aplicar (ver `rom/byte-order.ts`). */
  swapSize?: 1 | 2 | 4
}

/**
 * Os DATs não concordam entre si sobre header: os do No-Intro são headerless, mas circulam
 * DATs de NES que incluem o cabeçalho no hash. Calcular as duas variantes numa única leitura
 * evita ter que escolher errado — quem procura no índice tenta as duas.
 */
export interface RomHashVariants {
  /** O arquivo como está no disco. */
  full: RomHashes
  /** Sem os bytes de header. Ausente quando nenhum header foi detectado. */
  stripped?: RomHashes
}

const CHUNK_SIZE = 1024 * 1024

/** Acumulador dos três algoritmos, para não reler o arquivo por hash faltante. */
class HashAccumulator {
  private readonly crc = new Crc32()
  private readonly md5: Hash = createHash('md5')
  private readonly sha1: Hash = createHash('sha1')
  private size = 0
  private skipRemaining: number

  constructor(skipBytes = 0) {
    this.skipRemaining = skipBytes
  }

  update(chunk: Uint8Array): void {
    let bytes = chunk
    if (this.skipRemaining > 0) {
      const skipped = Math.min(this.skipRemaining, bytes.length)
      this.skipRemaining -= skipped
      bytes = bytes.subarray(skipped)
    }
    if (bytes.length === 0) return

    this.crc.update(bytes)
    this.md5.update(bytes)
    this.sha1.update(bytes)
    this.size += bytes.length
  }

  digest(): RomHashes {
    return {
      crc32: this.crc.hex(),
      md5: this.md5.digest('hex'),
      sha1: this.sha1.digest('hex'),
      size: this.size,
    }
  }
}

export async function hashChunkVariants(
  chunks: AsyncIterable<Uint8Array>,
  options: HashOptions = {},
): Promise<RomHashVariants> {
  const swapSize = options.swapSize ?? 1
  const headerOffset = options.headerOffset ?? 0

  const full = new HashAccumulator()
  const stripped = headerOffset > 0 ? new HashAccumulator(headerOffset) : null

  // O byte swap opera em grupos que podem cruzar a fronteira entre dois chunks; o que não
  // completa um grupo espera o chunk seguinte.
  // `ArrayBufferLike` porque os chunks vêm de streams do Node, cujo Buffer pode estar apoiado
  // num buffer compartilhado — o tipo estrito `Uint8Array<ArrayBuffer>` não os aceitaria.
  let pending: Uint8Array<ArrayBufferLike> = new Uint8Array(0)

  for await (const chunk of chunks) {
    let bytes: Uint8Array<ArrayBufferLike> = chunk

    if (swapSize !== 1) {
      const combined = pending.length > 0 ? concatBytes(pending, chunk) : chunk
      const alignedLength = Math.floor(combined.length / swapSize) * swapSize
      pending = combined.subarray(alignedLength)
      bytes = applyByteSwap(combined.slice(0, alignedLength), swapSize)
    }

    full.update(bytes)
    stripped?.update(bytes)
  }

  // Sobra que nunca completou um grupo: entra sem reordenação, como em `applyByteSwap`.
  if (pending.length > 0) {
    full.update(pending)
    stripped?.update(pending)
  }

  return {
    full: full.digest(),
    ...(stripped !== null && { stripped: stripped.digest() }),
  }
}

/** Variante de conveniência para quem só quer um resultado (sem header, se houver). */
export async function hashChunks(
  chunks: AsyncIterable<Uint8Array>,
  options: HashOptions = {},
): Promise<RomHashes> {
  const variants = await hashChunkVariants(chunks, options)
  return variants.stripped ?? variants.full
}

function fileChunks(path: string): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      const handle = await open(path, 'r')
      try {
        yield* handle.createReadStream({ highWaterMark: CHUNK_SIZE })
      } finally {
        await handle.close()
      }
    },
  }
}

export async function hashFileVariants(
  path: string,
  options: HashOptions = {},
): Promise<RomHashVariants> {
  return hashChunkVariants(fileChunks(path), options)
}

export async function hashFile(path: string, options: HashOptions = {}): Promise<RomHashes> {
  return hashChunks(fileChunks(path), options)
}

function memoryChunks(data: Uint8Array): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        yield data.subarray(offset, offset + CHUNK_SIZE)
      }
    },
  }
}

/** Atalho para conteúdo já em memória (ROM dentro de zip, fixture de teste). */
export async function hashBytes(data: Uint8Array, options: HashOptions = {}): Promise<RomHashes> {
  return hashChunks(memoryChunks(data), options)
}

export async function hashBytesVariants(
  data: Uint8Array,
  options: HashOptions = {},
): Promise<RomHashVariants> {
  return hashChunkVariants(memoryChunks(data), options)
}
