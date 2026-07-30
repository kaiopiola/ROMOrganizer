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

interface Rgb {
  r: number
  g: number
  b: number
}

const BACKGROUND_TOP: Rgb = { r: 24, g: 36, b: 31 }
const BACKGROUND_BOTTOM: Rgb = { r: 10, g: 12, b: 11 }
const CARTRIDGE: Rgb = { r: 16, g: 185, b: 129 }
const CARTRIDGE_SHADE: Rgb = { r: 8, g: 145, b: 101 }
const LABEL: Rgb = { r: 233, g: 245, b: 240 }

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
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - radius
}

function mix(base: Rgb, over: Rgb, alpha: number): Rgb {
  return {
    r: Math.round(base.r + (over.r - base.r) * alpha),
    g: Math.round(base.g + (over.g - base.g) * alpha),
    b: Math.round(base.b + (over.b - base.b) * alpha),
  }
}

/**
 * Cor de um ponto do ícone, em coordenadas de 0 a 1.
 *
 * A silhueta é um cartucho visto de frente: corpo alto, ombros estreitados no topo e uma
 * etiqueta clara ocupando o terço de cima. É a forma que continua legível quando o ícone vira
 * 16 pixels na barra de tarefas.
 */
function colorAt(u: number, v: number): Rgb {
  // Fundo com um degradê discreto, para o ícone não parecer chapado no dock.
  let color = mix(BACKGROUND_TOP, BACKGROUND_BOTTOM, v)

  const bodyTop = 0.13
  const bodyBottom = 0.89
  const body = roundedRectDistance(
    u,
    v,
    0.5,
    (bodyTop + bodyBottom) / 2,
    0.3,
    (bodyBottom - bodyTop) / 2,
    0.05,
  )

  if (body < 0) {
    // Volume por degradê lateral, e não por um corte de cor: um degrau duro no meio do
    // cartucho lê como defeito, não como sombra.
    const shade = Math.max(0, (u - 0.4) / 0.4)
    color = mix(CARTRIDGE, CARTRIDGE_SHADE, Math.min(shade, 1) ** 2)

    // Chanfro nos cantos de cima, que é o que distingue a silhueta de um retângulo comum.
    const chamfer = 0.085
    const fromTop = v - bodyTop
    const fromSide = Math.min(u - 0.2, 0.8 - u)
    if (fromTop < chamfer && fromSide < chamfer - fromTop) {
      color = mix(BACKGROUND_TOP, BACKGROUND_BOTTOM, v)
    }
  }

  // Etiqueta: o elemento que faz a forma ser lida como cartucho, e não como um bloco.
  const label = roundedRectDistance(u, v, 0.5, 0.385, 0.21, 0.13, 0.025)
  if (label < 0) color = LABEL

  // Ranhuras do conector, na base. Somem em tamanho pequeno, e é aceitável: são o detalhe
  // que enriquece o ícone grande sem sustentar a leitura do pequeno.
  if (body < 0 && v > 0.68 && v < 0.82) {
    const period = 0.06
    const phase = (u - 0.25) / period
    if (u > 0.25 && u < 0.75 && phase - Math.floor(phase) < 0.5) {
      color = mix(BACKGROUND_TOP, BACKGROUND_BOTTOM, 0.7)
    }
  }

  return color
}

function renderPixels(): Buffer {
  const pixels = Buffer.alloc(SIZE * SIZE * 4)

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      // Média das amostras: as bordas arredondadas saem suaves em vez de serrilhadas.
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const u = (x + (sx + 0.5) / SUPERSAMPLE) / SIZE
          const v = (y + (sy + 0.5) / SUPERSAMPLE) / SIZE

          const inside = roundedRectDistance(u, v, 0.5, 0.5, 0.5, 0.5, 0.22) < 0
          if (!inside) continue

          const color = colorAt(u, v)
          r += color.r
          g += color.g
          b += color.b
          a += 255
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE
      const offset = (y * SIZE + x) * 4
      const coverage = a / samples / 255

      // Cor média só dos pontos cobertos, para a borda não escurecer contra o transparente.
      const covered = Math.max(a / 255, 1)
      pixels[offset] = Math.round(r / covered)
      pixels[offset + 1] = Math.round(g / covered)
      pixels[offset + 2] = Math.round(b / covered)
      pixels[offset + 3] = Math.round(coverage * 255)
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
  header.writeUInt8(8, 8) // bits por canal
  header.writeUInt8(6, 9) // RGBA
  header.writeUInt8(0, 10) // compressão
  header.writeUInt8(0, 11) // filtro
  header.writeUInt8(0, 12) // sem entrelaçamento

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
