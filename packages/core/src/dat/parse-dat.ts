import { parseClrMameProDat } from './clrmamepro.ts'
import { parseLogiqxDat, type ParsedDat } from './logiqx.ts'

export type DatFormat = 'logiqx' | 'clrmamepro'

/**
 * Descobre o dialeto pelo começo do conteúdo.
 *
 * As duas fontes que o projeto aceita usam formatos diferentes — No-Intro entrega XML Logiqx,
 * o libretro-database entrega clrmamepro — e o usuário que aponta um arquivo `.dat` não tem
 * por que saber a diferença.
 */
export function detectDatFormat(text: string): DatFormat {
  const head = text.slice(0, 512).trimStart()
  return head.startsWith('<') ? 'logiqx' : 'clrmamepro'
}

export function parseDat(text: string): ParsedDat {
  return detectDatFormat(text) === 'logiqx' ? parseLogiqxDat(text) : parseClrMameProDat(text)
}
