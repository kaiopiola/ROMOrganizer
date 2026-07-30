/**
 * Gera o ícone do app.
 *
 * Desenhado em código, e não exportado de um editor, por dois motivos: o resultado é
 * reproduzível a partir do repositório, e a forma pode ser ajustada olhando o que aparece em
 * 16px — que é onde um ícone de verdade é julgado, e onde detalhe demais vira borrão.
 *
 * Uso: `node scripts/make-icon.ts`
 */
import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Crc32 } from '../packages/core/src/hash/crc32.ts'

const SIZE = 1024
/** Renderiza maior e reduz: é o antialiasing, sem depender de biblioteca gráfica. */
const SUPERSAMPLE = 4

/**
 * Espessura do traço, em fração do lado.
 *
 * Generosa de propósito: em line art, o traço fino é a primeira coisa a desaparecer quando o
 * ícone vira 32 ou 16 pixels.
 */
const STROKE = 0.034

interface Point {
  x: number
  y: number
}

/**
 * Distância assinada até um polígono. Negativa dentro da forma.
 *
 * Necessária porque o cartucho tem cantos chanfrados e reentrâncias laterais, e um retângulo
 * arredondado não descreve isso — em line art o traço precisa seguir a silhueta exata.
 */
function polygonDistance(px: number, py: number, vertices: readonly Point[]): number {
  const first = vertices[0] as Point
  let squared = (px - first.x) ** 2 + (py - first.y) ** 2
  let sign = 1

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const current = vertices[i] as Point
    const previous = vertices[j] as Point

    const edgeX = previous.x - current.x
    const edgeY = previous.y - current.y
    const toPointX = px - current.x
    const toPointY = py - current.y

    const projection = Math.min(
      Math.max((toPointX * edgeX + toPointY * edgeY) / (edgeX * edgeX + edgeY * edgeY), 0),
      1,
    )
    const offsetX = toPointX - edgeX * projection
    const offsetY = toPointY - edgeY * projection
    squared = Math.min(squared, offsetX * offsetX + offsetY * offsetY)

    // Winding number: as três condições juntas decidem se o ponto está dentro.
    const conditions = [py >= current.y, py < previous.y, edgeX * toPointY > edgeY * toPointX]
    if (conditions.every(Boolean) || conditions.every((value) => !value)) sign = -sign
  }

  return sign * Math.sqrt(squared)
}

/** Distância assinada até um retângulo de cantos arredondados. */
function roundedRectDistance(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const dx = Math.abs(x - centerX) - (halfWidth - radius)
  const dy = Math.abs(y - centerY) - (halfHeight - radius)
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius
}

const LEFT = 0.17
const RIGHT = 0.83
const TOP = 0.09
const BOTTOM = 0.91
const CHAMFER = 0.11
const NOTCH = 0.05

/**
 * Silhueta do cartucho de SNES: corpo alto, ombros chanfrados e uma reentrância nas laterais
 * logo abaixo deles — é essa reentrância que distingue a forma de um retângulo qualquer.
 */
const CARTRIDGE: readonly Point[] = [
  { x: LEFT + CHAMFER, y: TOP },
  { x: RIGHT - CHAMFER, y: TOP },
  { x: RIGHT, y: TOP + CHAMFER },
  { x: RIGHT, y: 0.28 },
  { x: RIGHT - NOTCH, y: 0.34 },
  { x: RIGHT - NOTCH, y: BOTTOM },
  { x: LEFT + NOTCH, y: BOTTOM },
  { x: LEFT + NOTCH, y: 0.34 },
  { x: LEFT, y: 0.28 },
  { x: LEFT, y: TOP + CHAMFER },
]

/** Cor da placa de fundo. */
const PLATE = { r: 22, g: 24, b: 26 }

/**
 * Onde há traço.
 *
 * Tudo é contorno: o desenho é feito de linhas, sem preenchimento, e a única cor é o branco.
 */
function inkAt(u: number, v: number): boolean {
  const half = STROKE / 2

  if (Math.abs(polygonDistance(u, v, CARTRIDGE)) < half) return true

  // Etiqueta.
  if (Math.abs(roundedRectDistance(u, v, 0.5, 0.46, 0.2, 0.14, 0.02)) < half) return true

  // Ranhuras do conector, na base — traços verticais, que é o que elas são de fato.
  if (v > 0.72 && v < 0.84) {
    const period = 0.078
    const phase = (u - 0.3) / period
    const onStripe = Math.abs(phase - Math.round(phase)) * period < half
    if (u > 0.29 && u < 0.71 && onStripe) return true
  }

  return false
}

function renderPixels(): Buffer {
  const pixels = Buffer.alloc(SIZE * SIZE * 4)

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let ink = 0
      let plate = 0

      // Média das amostras: diagonais e curvas saem suaves em vez de serrilhadas.
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const u = (x + (sx + 0.5) / SUPERSAMPLE) / SIZE
          const v = (y + (sy + 0.5) / SUPERSAMPLE) / SIZE
          if (roundedRectDistance(u, v, 0.5, 0.5, 0.5, 0.5, 0.22) < 0) plate += 1
          if (inkAt(u, v)) ink += 1
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE
      const plateAlpha = plate / samples
      const inkAlpha = ink / samples
      const offset = (y * SIZE + x) * 4

      // A placa escura existe por uma razão prática: traço branco sobre transparente some
      // num dock claro, e um ícone de app aparece tanto em fundo claro quanto escuro.
      const channel = (base: number): number => Math.round(255 * inkAlpha + base * (1 - inkAlpha))

      pixels[offset] = channel(PLATE.r)
      pixels[offset + 1] = channel(PLATE.g)
      pixels[offset + 2] = channel(PLATE.b)
      pixels[offset + 3] = Math.round(Math.max(plateAlpha, inkAlpha) * 255)
    }
  }

  return pixels
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(new Crc32().update(typeAndData).value())

  return Buffer.concat([length, typeAndData, crc])
}

/** Codifica PNG RGBA. O formato é simples o bastante para não valer uma dependência. */
function encodePng(pixels: Buffer): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header.writeUInt8(8, 8)
  header.writeUInt8(6, 9)
  header.writeUInt8(0, 10)
  header.writeUInt8(0, 11)
  header.writeUInt8(0, 12)

  // Cada linha é precedida do byte de filtro; zero significa "sem filtro".
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0
    pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'desktop',
  'build',
  'icon.png',
)

await mkdir(dirname(target), { recursive: true })
await writeFile(target, encodePng(renderPixels()))
console.log(`ícone gerado: ${target} (${SIZE}×${SIZE})`)
