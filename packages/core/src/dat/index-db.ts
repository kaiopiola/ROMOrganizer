import { DatabaseSync } from 'node:sqlite'
import type { ParsedDat } from './logiqx.ts'

/**
 * Uma ROM do índice que casou com o arquivo em disco.
 *
 * `datSource` acompanha o resultado porque o mesmo hash pode existir em mais de um DAT
 * (No-Intro e libretro divergem em nomenclatura, por exemplo) — e essa ambiguidade tem que
 * chegar visível na interface, não ser resolvida às escondidas.
 */
export interface IndexMatch {
  gameName: string
  romName: string
  size: number
  crc32: string | null
  md5: string | null
  sha1: string | null
  datSource: string
}

/** Qual hash produziu o match. Mais forte primeiro — é a ordem em que são tentados. */
export type MatchedBy = 'sha1' | 'md5' | 'crc32'

export interface LookupResult {
  matchedBy: MatchedBy
  matches: IndexMatch[]
}

export interface LookupInput {
  crc32?: string
  md5?: string
  sha1?: string
}

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS dat_source (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    version     TEXT,
    imported_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rom (
    id        INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES dat_source(id) ON DELETE CASCADE,
    game_name TEXT NOT NULL,
    rom_name  TEXT NOT NULL,
    size      INTEGER NOT NULL,
    crc32     TEXT,
    md5       TEXT,
    sha1      TEXT
  );

  CREATE INDEX IF NOT EXISTS rom_crc32_idx ON rom (crc32) WHERE crc32 IS NOT NULL;
  CREATE INDEX IF NOT EXISTS rom_md5_idx   ON rom (md5)   WHERE md5 IS NOT NULL;
  CREATE INDEX IF NOT EXISTS rom_sha1_idx  ON rom (sha1)  WHERE sha1 IS NOT NULL;
`

const SELECT_COLUMNS = `
  rom.game_name AS gameName,
  rom.rom_name  AS romName,
  rom.size      AS size,
  rom.crc32     AS crc32,
  rom.md5       AS md5,
  rom.sha1      AS sha1,
  dat_source.name AS datSource
`

/**
 * Índice de DATs em SQLite.
 *
 * Usa o `node:sqlite` embutido em vez de um binding nativo: um set completo de No-Intro passa
 * de 100 mil linhas e precisa de índice de verdade, mas trazer `better-sqlite3` custaria
 * rebuild por plataforma no CI e tiraria do core a propriedade de rodar em Node puro.
 */
export class DatIndex {
  private readonly db: DatabaseSync

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path)
    this.db.exec(SCHEMA)
  }

  /**
   * Importa um DAT já parseado. Reimportar o mesmo DAT substitui as entradas anteriores,
   * para que atualizar a base não acumule duplicatas.
   */
  importDat(parsed: ParsedDat, importedAt = new Date().toISOString()): number {
    this.db.exec('BEGIN')
    try {
      this.db.prepare('DELETE FROM dat_source WHERE name = ?').run(parsed.name)
      const { lastInsertRowid } = this.db
        .prepare('INSERT INTO dat_source (name, version, imported_at) VALUES (?, ?, ?)')
        .run(parsed.name, parsed.version ?? null, importedAt)

      const insert = this.db.prepare(
        `INSERT INTO rom (source_id, game_name, rom_name, size, crc32, md5, sha1)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const entry of parsed.entries) {
        insert.run(
          lastInsertRowid,
          entry.gameName,
          entry.romName,
          entry.size,
          entry.crc32 ?? null,
          entry.md5 ?? null,
          entry.sha1 ?? null,
        )
      }

      this.db.exec('COMMIT')
      return parsed.entries.length
    } catch (cause) {
      this.db.exec('ROLLBACK')
      throw cause
    }
  }

  /**
   * Procura pelo hash mais forte disponível e para no primeiro que casar.
   *
   * A ordem importa: colisão de CRC32 é rara mas real numa base de centenas de milhares de
   * entradas, então um match por SHA1 nunca deve ser preterido por um por CRC.
   */
  lookup(hashes: LookupInput): LookupResult | null {
    const attempts: [MatchedBy, string | undefined][] = [
      ['sha1', hashes.sha1],
      ['md5', hashes.md5],
      ['crc32', hashes.crc32],
    ]

    for (const [matchedBy, value] of attempts) {
      if (value === undefined) continue
      const matches = this.db
        .prepare(
          `SELECT ${SELECT_COLUMNS}
           FROM rom JOIN dat_source ON dat_source.id = rom.source_id
           WHERE rom.${matchedBy} = ?
           ORDER BY dat_source.name, rom.game_name`,
        )
        .all(value.toLowerCase()) as unknown as IndexMatch[]

      if (matches.length > 0) return { matchedBy, matches }
    }

    return null
  }

  /** DATs presentes no índice, para a interface mostrar o que está carregado. */
  sources(): { name: string; version: string | null; romCount: number }[] {
    return this.db
      .prepare(
        `SELECT dat_source.name AS name,
                dat_source.version AS version,
                COUNT(rom.id) AS romCount
         FROM dat_source LEFT JOIN rom ON rom.source_id = dat_source.id
         GROUP BY dat_source.id
         ORDER BY dat_source.name`,
      )
      .all() as unknown as { name: string; version: string | null; romCount: number }[]
  }

  close(): void {
    this.db.close()
  }
}
