# Features

_[Português (Brasil)](features.pt-BR.md)_

What the app does, and why it does it that way. For the short version, see the
[README](../README.md).

---

## Libraries

A library is a folder linked to a console. That is the whole model: you point at where the ROMs
of each system live, and everything else happens per library.

Each library keeps its own settings — which database to use, its naming pattern, whether to
include subfolders. A console that needs a local DAT does not force that choice on the others.
New libraries start from what you last chose, so ten consoles do not mean ten setups from
scratch.

Everything the app writes about a collection lives inside the collection itself, under
`.romorg/`: the hash cache, the undo journals and the last scan result. Move the folder and its
history goes with it.

---

## Identification

This is the core of the project. Guessing a game from its filename is what makes other tools get
it wrong, so here the filename is the **last** resort — and the interface always shows which
path was taken.

The order:

1. **Hash against the DAT.** CRC32, MD5 and SHA1 are computed in a single pass. The strongest
   available hash wins, because CRC32 collisions are rare but real in a base of hundreds of
   thousands of entries.
2. **Hash with the header stripped.** No-Intro DATs are _headerless_: a `.nes` carrying an iNES
   header (16 bytes) or a `.smc` carrying an SMC header (512 bytes) never matches if hashed raw.
   Both variants are computed in the same read, so it works whether or not your DAT includes the
   header — you do not need to know which one you imported.
3. **Byte order normalization.** `.z64`, `.v64` and `.n64` are the same dump with bytes swapped.
   The file is normalized before hashing, so a `.v64` matches a `.z64` DAT.
4. **Filename heuristics.** No-Intro and GoodTools conventions are parsed, but the result is
   flagged as a guess and is **not** renamed unless you explicitly ask for it.

### Archives

ROMs inside `.zip` are handled — and usually **without decompressing anything**. The zip format
already stores the CRC32 of each entry's uncompressed content, which is enough to identify most
of a collection. Decompression only happens when that shortcut fails, which in practice means a
header to strip or byte order to normalize.

### When DATs disagree

The same hash can exist in more than one DAT under different names. Both candidates surface,
the row is marked ambiguous, and nothing is applied until you decide.

---

## Databases

- **libretro-database** — downloaded on demand and cached locally. For systems that have one,
  both the `no-intro` and `headered` collections are fetched, which is what makes a `.nes` match
  either way.
- **Your own DATs** — No-Intro or Redump files you maintain. Both dialects are supported: Logiqx
  XML and clrmamepro.

Both are per library. The cache falls back to a stale copy when the network is down, because a
week-old DAT identifies far more than no DAT at all.

---

## Renaming

Nothing is written before you approve it.

**Every batch is a plan you review first.** The plan shows what will happen and, for everything
left out, why:

| Reason               | Meaning                                                   |
| -------------------- | --------------------------------------------------------- |
| already correct      | the file is already where and how it should be            |
| no name to propose   | nothing matched and the name says nothing                 |
| DATs disagree        | more than one candidate, and picking one would be a guess |
| name already taken   | a different file already occupies the destination         |
| two files, same name | two sources compete for one destination                   |

You can select line by line or apply everything.

### Undo

**Every batch can be undone.** The journal is written as the batch runs, flushed line by line —
so even a crash mid-batch leaves the undo intact. Undo runs in reverse order, because a batch can
move A into the name B just vacated.

The executor also refuses to overwrite. `fs.rename` would replace the destination silently, which
for a ROM collection means deleting a file with no warning.

### Naming pattern

The pattern is yours to write. `{region}/{title}.{ext}` puts each game in a folder by region;
`{title} [({region})].{ext}` only renames.

- `[ ... ]` marks an optional group — it disappears entirely when a token inside it is empty, so
  an unknown region gives `Game.nes` and not `Game ().nes`
- `/` creates subfolders, counted **from the library root** — otherwise a recursive scan would
  nest deeper on every run
- Available tokens: `title`, `region`, `regions`, `language`, `revision`, `year`, `system`,
  `manufacturer`, `letter`, `ext`

The preview updates as you type, and it is produced by the same code that does the work — it is
not an approximation.

The pattern is saved per console, so the next library of the same system starts configured.

### Quarantine

Unidentified files can be moved to a folder of your choosing. The name is preserved: the file
changes place, not identity. Nothing is ever deleted.

---

## Audit

Compares your collection against what the DATs list.

- **Have / missing**, with a completion percentage
- **Region filter** — what makes auditing a 1G1R set useful; without it, a USA/Europe set shows
  every Japanese release as missing
- **Prototypes and betas are excluded by default**, since someone asking "what am I missing"
  rarely counts a beta that never shipped
- **Duplicates** — the same game present more than once
- **Unrecognized** — files no DAT claims, which is where bad dumps, hacks and translations live
- Export to **CSV** or **Markdown**

The audit works on a scan that already happened; it does not re-read disk.

---

## Playlists

Per platform, from the Playlists screen.

- **RetroArch `.lpl`** with the correct database name, which is what links entries to thumbnails
- Content inside zip is pointed to as `archive.zip#entry`, the form RetroArch understands
- **Multi-disc games are grouped into `.m3u`** and appear as a single entry — listing `Disc 1`
  and `Disc 2` next to the `.m3u` would hand back the mess the grouping exists to solve
- Only what matched a DAT is included: a playlist is a list of games, not of filenames

---

## Queue

Identifying and renaming go through a queue, **one job at a time**. That is deliberate: both are
disk operations, and running several libraries in parallel competes for the same disk — it
usually makes the total slower and the progress unreadable.

Queue everything and walk away. The footer bar shows what is running and how many are waiting;
the Queue screen separates active from finished and keeps the reason for anything that failed.
Any job can be cancelled — while queued it never starts, while running the main process stops
it, and a cancelled batch still leaves its journal for undo.

---

## Performance

- **Hash cache** next to the collection, keyed by size and mtime. A second scan does not re-read
  what has not changed. The cache stores **hashes**, not identification results, so changing or
  updating a DAT invalidates nothing — the index lookup is cheap and always redone.
- **The zip CRC shortcut** described above.
- The **last scan is saved**, so opening a library already identified shows it immediately
  instead of an empty screen. It is revalidated on load: files that disappeared are dropped and
  you are told.

---

## Interface

- English and Portuguese, following the system or set manually
- Console icons from the RetroArch asset set, fetched on demand
- Virtualized table, since a console collection passes ten thousand files easily
- Settings screen with app preferences, release notes and update check

---

## Updates

- **Windows and Linux** — the app installs updates itself
- **macOS** — it detects a new version and opens the release page. Squirrel.Mac refuses to apply
  an update to an unsigned app, and this project ships without a certificate, so automatic
  installation is impossible. The interface says so instead of offering a button that fails.

---

## Not included, on purpose

- No downloading, searching or indexing of game content
- Nothing is ever deleted — the strongest action is moving a file
- No writing to disk without a plan you approved first
