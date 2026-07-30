# ROMOrganizer

_[Português (Brasil)](README.pt-BR.md)_

An open source desktop tool that **organizes the ROM collection you already have**.
It identifies each file by hash, resolves its title and region, and renames it — instead of
guessing from the filename.

> **Bring your own files.** ROMOrganizer does not download, search for, or distribute ROMs.
> It only works on files already on your disk.

## Status

Under development. Identification, renaming with undo, collection audit and RetroArch
playlists all work. There is no packaged release yet — build from source for now.

## Installing

Downloads are on the [releases page](https://github.com/kaiopiola/ROMOrganizer/releases).

The builds are **not code-signed** — there is no Apple Developer certificate and no Windows
certificate behind this project. That has two consequences worth knowing before you download:

- **macOS**: Gatekeeper blocks the first launch. Right-click the app and choose _Open_, or run
  `xattr -dr com.apple.quarantine /Applications/ROMOrganizer.app`.
- **Windows**: SmartScreen shows a warning. Choose _More info_ → _Run anyway_.

**Updates**: on Windows and Linux the app updates itself. On macOS it only tells you a new
version exists and opens the release page — Squirrel.Mac refuses to apply an update to an
unsigned app, so automatic installation is impossible without a certificate.

## How it works

Guessing a ROM from its filename is exactly what makes other tools get it wrong. The order here is:

1. **Hash against a DAT** (CRC32/SHA1) — the source of truth.
2. **Hash with the header stripped**, because No-Intro DATs are _headerless_: a `.nes` carrying
   an iNES header (16 bytes) or a `.smc` carrying an SMC header (512 bytes) will never match
   its CRC if hashed raw.
3. **Byte order normalization** for the N64 (`.z64` / `.v64` / `.n64` are the same dump with
   bytes swapped).
4. **Filename heuristics** — last resort only, and flagged as such in the interface.

Nothing changes without your review: every batch goes through a **dry run**, and every execution
writes a journal that makes it **undoable**.

ROMs inside `.zip` are handled too — and usually without decompressing anything, since the zip
format already stores the CRC32 of each entry's uncompressed content.

## Databases

- **libretro-database** — fetched on demand, versioned and updatable. Both the `no-intro` and
  `headered` collections are pulled for systems that have one, which is what makes a `.nes`
  match whether or not it carries a header.
- **Manual import** of No-Intro / Redump DATs, for people who maintain exact sets.

Both DAT dialects are supported: Logiqx XML (No-Intro) and clrmamepro (libretro-database).

## Development

Requires Node 22+ and pnpm (via `corepack enable pnpm`).

```bash
pnpm install
```

```bash
pnpm dev
```

Other commands:

| Command          | What it does                  |
| ---------------- | ----------------------------- |
| `pnpm test`      | Core test suite (Vitest)      |
| `pnpm typecheck` | Type checking across packages |
| `pnpm lint`      | ESLint                        |
| `pnpm build`     | Build every package           |

The CLI runs straight from source, no build step:

```bash
node packages/cli/src/index.ts scan ~/roms/snes --system snes --libretro
```

### Layout

| Path            | Role                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| `packages/core` | ROM identification. Plain Node, no Electron — where the logic lives.      |
| `packages/cli`  | Headless interface on top of the core.                                    |
| `apps/desktop`  | Electron app: main process (disk, database), preload, and React renderer. |
| `data/systems`  | Per-console rule packs in JSON — the easiest way to contribute.           |

The `core` package is deliberately Electron-free: it tests in milliseconds, and you can
contribute to it without ever opening the app.

## Contributing

Adding support for a console is a pull request with **one JSON file** in `data/systems/` plus a
test. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Legal scope

- The tool operates on files **already on the user's disk**.
- It does not download ROMs, does not search for them, does not index sources, and does not
  accept links to them.
- The DATs it uses are **metadata** (name, hash, region) — never game content. Those fetched
  from [libretro-database](https://github.com/libretro/libretro-database) are licensed
  CC BY-SA 4.0 and are downloaded on demand by the user, not redistributed with the app.
- Console icons come from [retroarch-assets](https://github.com/libretro/retroarch-assets)
  (CC BY 4.0), also fetched on demand and cached locally.
- No ROM, BIOS, or proprietary header belongs in this repository, **including test fixtures**,
  which are generated synthetically.
- Issues and pull requests asking for or offering ROMs are closed without discussion.

## License

[GPL-3.0-or-later](LICENSE).
