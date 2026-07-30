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

const LEFT = 0.17
const RIGHT = 0.83
const TOP = 0.13
const BOTTOM = 0.87

/** Cor da placa de fundo. */
const PLATE = { r: 22, g: 24, b: 26 }

/**
 * Onde há traço.
 *
 * Tudo é contorno: o desenho é feito de linhas, sem preenchimento, e a única cor é o branco.
 */
function inkAt(u: number, v: number): boolean {
  const half = STROKE / 2

  // Corpo: retângulo de cantos levemente arredondados.
  const body = roundedRectDistance(
    u,
    v,
    (LEFT + RIGHT) / 2,
    (TOP + BOTTOM) / 2,
    (RIGHT - LEFT) / 2,
    (BOTTOM - TOP) / 2,
    0.04,
  )
  if (Math.abs(body) < half) return true

  // Vincos de empunhadura, no alto — no cartucho de SNES eles ficam acima da etiqueta, e o
  // conector fica escondido dentro da carcaça. Colocá-los embaixo dava um cartucho de Switch.
  if (v > 0.19 && v < 0.29) {
    const period = 0.075
    const phase = (u - 0.28) / period
    const onGroove = Math.abs(phase - Math.round(phase)) * period < half
    if (u > 0.27 && u < 0.73 && onGroove) return true
  }

  // Etiqueta: ocupa a maior parte da face, como na peça real.
  if (Math.abs(roundedRectDistance(u, v, 0.5, 0.575, 0.24, 0.21, 0.02)) < half) return true

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
