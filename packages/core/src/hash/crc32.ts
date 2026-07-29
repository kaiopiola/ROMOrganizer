/**
 * CRC32 (polinômio IEEE 802.3, o mesmo do zip e dos DATs No-Intro).
 *
 * Implementado aqui em vez de vir de um pacote porque precisa ser **incremental**: as ROMs
 * são hasheadas em stream, e um `crc32(buffer)` de uma tacada só obrigaria a carregar
 * arquivos inteiros na memória.
 */

const TABLE = buildTable()

function buildTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value >>> 0
  }
  return table
}

export class Crc32 {
  private state = 0xffffffff

  update(chunk: Uint8Array): this {
    let state = this.state
    for (let i = 0; i < chunk.length; i += 1) {
      state = (TABLE[(state ^ (chunk[i] as number)) & 0xff] as number) ^ (state >>> 8)
    }
    this.state = state
    return this
  }

  /** Valor final como inteiro sem sinal. */
  value(): number {
    return (this.state ^ 0xffffffff) >>> 0
  }

  /** Valor final em hex minúsculo de 8 dígitos — o formato usado nos DATs. */
  hex(): string {
    return this.value().toString(16).padStart(8, '0')
  }
}

export function crc32(data: Uint8Array): string {
  return new Crc32().update(data).hex()
}
