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
const STROKE = 0.026

interface Point {
  x: number
  y: number
}

/**
 * Distância assinada até um polígono. Negativa dentro da forma.
 *
 * Necessária porque a base do cartucho tem degraus nos cantos, e nenhuma primitiva arredondada
 * descreve isso — em line art o traço precisa seguir a silhueta exata.
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

/** Distância assinada até um retângulo de cantos arredondados. Negativa dentro da forma. */
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

/** Distância assinada a um segmento — o traço reto das letras. */
function segmentDistance(x: number, y: number, from: Point, to: Point): number {
  const edgeX = to.x - from.x
  const edgeY = to.y - from.y
  const toPointX = x - from.x
  const toPointY = y - from.y

  const projection = Math.min(
    Math.max((toPointX * edgeX + toPointY * edgeY) / (edgeX * edgeX + edgeY * edgeY), 0),
    1,
  )
  return Math.hypot(toPointX - edgeX * projection, toPointY - edgeY * projection)
}

/**
 * Distância aproximada até uma elipse — o bojo do R e o corpo do O.
 *
 * A distância exata a uma elipse exige resolver uma quártica; para traço fino a aproximação
 * radial erra menos que meio pixel, e o erro nem chega à imagem final.
 */
function ellipseDistance(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): number {
  const normalized = Math.hypot((x - centerX) / radiusX, (y - centerY) / radiusY)
  return (normalized - 1) * Math.min(radiusX, radiusY)
}

const LEFT = 0.11
const RIGHT = 0.89
const TOP = 0.17
const BOTTOM = 0.91

/** Onde a faixa de vincos termina e a etiqueta começa. */
const RIDGE_RIGHT = 0.4

/** Recuo dos cantos de baixo: a base do cartucho é mais estreita que o corpo. */
const STEP_WIDTH = 0.085
const STEP_HEIGHT = 0.075
const SKIRT = BOTTOM - STEP_HEIGHT

/**
 * Silhueta do cartucho de NES.
 *
 * As abas do topo ficaram de fora — em tamanho pequeno viravam um degrau sem leitura. Os degraus
 * da base ficam: são eles que dão o assentamento da peça e impedem que a forma leia como um
 * retângulo qualquer.
 */
const CARTRIDGE: readonly Point[] = [
  { x: LEFT, y: TOP },
  { x: RIGHT, y: TOP },
  { x: RIGHT, y: SKIRT },
  { x: RIGHT - STEP_WIDTH, y: SKIRT },
  { x: RIGHT - STEP_WIDTH, y: BOTTOM },
  { x: LEFT + STEP_WIDTH, y: BOTTOM },
  { x: LEFT + STEP_WIDTH, y: SKIRT },
  { x: LEFT, y: SKIRT },
]

/** Seta de inserção, abaixo da etiqueta. */
const ARROW: readonly Point[] = [
  { x: 0.605, y: 0.715 },
  { x: 0.725, y: 0.715 },
  { x: 0.665, y: 0.8 },
]

/** Cor da placa de fundo. */
const PLATE = { r: 22, g: 24, b: 26 }

/** O traço das letras é mais fino que o do desenho: no mesmo peso elas fechariam por dentro. */
const LETTER_STROKE = 0.024
const STEM = 0.598
const LETTER_RIGHT = 0.712

/** R desenhado a traço: haste, bojo e perna. */
function isLetterR(u: number, v: number, top: number, bottom: number): boolean {
  const half = LETTER_STROKE / 2
  const waist = top + (bottom - top) * 0.58

  if (segmentDistance(u, v, { x: STEM, y: top }, { x: STEM, y: bottom }) < half) return true
  if (
    u >= STEM &&
    Math.abs(
      ellipseDistance(u, v, STEM, (top + waist) / 2, LETTER_RIGHT - STEM, (waist - top) / 2),
    ) < half
  ) {
    return true
  }
  return segmentDistance(u, v, { x: STEM + 0.02, y: waist }, { x: LETTER_RIGHT, y: bottom }) < half
}

/** O é um anel elíptico. */
function isLetterO(u: number, v: number, top: number, bottom: number): boolean {
  const centerY = (top + bottom) / 2
  const distance = ellipseDistance(
    u,
    v,
    (STEM + LETTER_RIGHT) / 2,
    centerY,
    (LETTER_RIGHT - STEM) / 2,
    (bottom - top) / 2,
  )
  return Math.abs(distance) < LETTER_STROKE / 2
}

/**
 * Onde há traço.
 *
 * Tudo é contorno: o desenho é feito de linhas, sem preenchimento, e a única cor é o branco.
 */
function inkAt(u: number, v: number): boolean {
  const half = STROKE / 2

  if (Math.abs(polygonDistance(u, v, CARTRIDGE)) < half) return true
  if (Math.abs(polygonDistance(u, v, ARROW)) < half) return true

  // Faixa de vincos à esquerda: linhas horizontais que vão da borda até a etiqueta. São muitas
  // na peça real; aqui são poucas e grossas, porque em 32px o resto vira borrão cinza.
  if (u > LEFT && u < RIDGE_RIGHT && v > TOP && v < SKIRT - 0.03) {
    const period = 0.1
    const phase = (v - (TOP + period * 0.75)) / period
    if (Math.abs(phase - Math.round(phase)) * period < half) return true
  }

  // Etiqueta: ocupa toda a metade direita, como na peça real.
  if (Math.abs(roundedRectDistance(u, v, 0.655, 0.455, 0.185, 0.21, 0.015)) < half) return true

  // RO empilhado dentro da etiqueta.
  if (isLetterR(u, v, 0.295, 0.445)) return true
  if (isLetterO(u, v, 0.475, 0.625)) return true

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
