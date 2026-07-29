import { parseDat } from './parse-dat.ts'
import type { ParsedDat } from './logiqx.ts'
import type { SystemRulePack } from '../systems/types.ts'

/**
 * Cliente do libretro-database.
 *
 * O repositório publica os DATs em coleções separadas. `no-intro` é a principal; `headered`
 * traz as versões dos poucos sistemas cujo dump canônico inclui o cabeçalho (NES, Atari 7800,
 * Lynx). Importar as duas é o que faz um `.nes` ser reconhecido venha ele com header ou sem.
 *
 * Os DATs são metadados sob CC BY-SA 4.0 — nome, hash e região, nunca conteúdo de jogo — e são
 * baixados sob demanda pelo usuário, não redistribuídos com o app.
 */
export type LibretroCollection = 'no-intro' | 'headered' | 'redump'

export interface LibretroDatRef {
  /** Nome do DAT, sem a extensão `.dat`. */
  name: string
  collection: LibretroCollection
}

export interface FetchOptions {
  /**
   * Referência git a buscar. O padrão segue `master`; fixar uma tag ou commit torna o
   * resultado reproduzível quando isso importar mais que estar atualizado.
   */
  ref?: string
  signal?: AbortSignal
  /** Injetável para teste — por padrão o `fetch` global. */
  fetchImpl?: typeof fetch
}

const RAW_BASE = 'https://raw.githubusercontent.com/libretro/libretro-database'

export class LibretroFetchError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'LibretroFetchError'
    this.status = status
  }
}

export function libretroDatUrl(ref: LibretroDatRef, gitRef = 'master'): string {
  return `${RAW_BASE}/${gitRef}/metadat/${ref.collection}/${encodeURIComponent(ref.name)}.dat`
}

/**
 * Quais DATs cobrem um sistema.
 *
 * Só o NES tem hoje uma contraparte headered, mas a decisão fica no rule pack em vez de numa
 * lista embutida: um pack novo declara `libretroDat` e ganha as duas tentativas de graça.
 */
export function libretroRefsFor(system: SystemRulePack): LibretroDatRef[] {
  if (system.libretroDat === undefined) return []

  const refs: LibretroDatRef[] = [{ name: system.libretroDat, collection: 'no-intro' }]
  if (system.header !== undefined) {
    refs.push({ name: system.libretroDat, collection: 'headered' })
  }
  return refs
}

export async function fetchLibretroDat(
  ref: LibretroDatRef,
  options: FetchOptions = {},
): Promise<ParsedDat> {
  const doFetch = options.fetchImpl ?? fetch
  const url = libretroDatUrl(ref, options.ref)

  const response = await doFetch(url, options.signal ? { signal: options.signal } : {})
  if (!response.ok) {
    throw new LibretroFetchError(
      `não foi possível baixar "${ref.name}" (${ref.collection}): HTTP ${response.status}`,
      response.status,
    )
  }

  return parseDat(await response.text())
}

export interface FetchSystemResult {
  parsed: ParsedDat[]
  /** DATs que não existem para este sistema nesta coleção — esperado, não é erro. */
  missing: LibretroDatRef[]
}

/**
 * Baixa todos os DATs de um sistema.
 *
 * Um 404 na coleção `headered` é resultado normal (só três sistemas a têm), então ele vira
 * `missing` em vez de exceção. Qualquer outra falha continua estourando: rede fora ou rate
 * limit precisam chegar ao usuário, não sumir como "sistema sem DAT".
 */
export async function fetchLibretroDatsFor(
  system: SystemRulePack,
  options: FetchOptions = {},
): Promise<FetchSystemResult> {
  const parsed: ParsedDat[] = []
  const missing: LibretroDatRef[] = []

  for (const ref of libretroRefsFor(system)) {
    try {
      parsed.push(await fetchLibretroDat(ref, options))
    } catch (cause) {
      if (cause instanceof LibretroFetchError && cause.status === 404) {
        missing.push(ref)
        continue
      }
      throw cause
    }
  }

  return { parsed, missing }
}
