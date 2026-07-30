import { Crc32 } from '../hash/crc32.ts'

/**
 * Monta um `.zip` em memória, para os testes.
 *
 * Uma versão anterior chamava o binário `zip` do sistema — o que quebrava no runner do Windows,
 * onde ele não existe. Este encoder grava o formato à mão, sempre com o método "store" (sem
 * compressão): o leitor lê o CRC32 e os bytes crus do jeito que leria de um zip real, e é só
 * isso que os testes exercitam. Nenhuma ROM real entra aqui — o conteúdo é sintético.
 */

const LOCAL_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_HEADER_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
/** Bit 11: nomes em UTF-8, para entradas com acento. */
const UTF8_FLAG = 0x0800

interface StagedEntry {
  nameBytes: Buffer
  content: Uint8Array
  crc: number
  offset: number
}

/**
 * Serializa um zip a partir de um mapa nome→conteúdo.
 *
 * Diretórios não recebem entrada própria: o leitor os deduz do nome (`sub/dentro.nes`), e é
 * assim que os zips de coleção reais costumam vir.
 */
export function buildZip(files: Record<string, Uint8Array>): Buffer {
  const localParts: Buffer[] = []
  const entries: StagedEntry[] = []
  let offset = 0

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, 'utf8')
    const crc = new Crc32().update(content).value()

    const header = Buffer.alloc(30)
    header.writeUInt32LE(LOCAL_HEADER_SIGNATURE, 0)
    header.writeUInt16LE(20, 4) // versão necessária
    header.writeUInt16LE(UTF8_FLAG, 6)
    header.writeUInt16LE(0, 8) // método: store
    header.writeUInt16LE(0, 10) // hora
    header.writeUInt16LE(0, 12) // data
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(content.length, 18) // tamanho comprimido = original (store)
    header.writeUInt32LE(content.length, 22)
    header.writeUInt16LE(nameBytes.length, 26)
    header.writeUInt16LE(0, 28) // sem campo extra

    entries.push({ nameBytes, content, crc, offset })
    localParts.push(header, nameBytes, Buffer.from(content))
    offset += header.length + nameBytes.length + content.length
  }

  const centralParts: Buffer[] = []
  const centralStart = offset

  for (const entry of entries) {
    const header = Buffer.alloc(46)
    header.writeUInt32LE(CENTRAL_HEADER_SIGNATURE, 0)
    header.writeUInt16LE(20, 4) // versão que gerou
    header.writeUInt16LE(20, 6) // versão necessária
    header.writeUInt16LE(UTF8_FLAG, 8)
    header.writeUInt16LE(0, 10) // método: store
    header.writeUInt16LE(0, 12) // hora
    header.writeUInt16LE(0, 14) // data
    header.writeUInt32LE(entry.crc, 16)
    header.writeUInt32LE(entry.content.length, 20)
    header.writeUInt32LE(entry.content.length, 24)
    header.writeUInt16LE(entry.nameBytes.length, 28)
    header.writeUInt16LE(0, 30) // sem campo extra
    header.writeUInt16LE(0, 32) // sem comentário
    header.writeUInt16LE(0, 34) // disco inicial
    header.writeUInt16LE(0, 36) // atributos internos
    header.writeUInt32LE(0, 38) // atributos externos
    header.writeUInt32LE(entry.offset, 42)

    centralParts.push(header, entry.nameBytes)
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  end.writeUInt16LE(0, 4) // número do disco
  end.writeUInt16LE(0, 6) // disco do diretório central
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralStart, 16)
  end.writeUInt16LE(0, 20) // sem comentário

  return Buffer.concat([...localParts, ...centralParts, end])
}
