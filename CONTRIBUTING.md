# Contributing to ROMOrganizer

_[Português (Brasil)](CONTRIBUTING.pt-BR.md)_

Thanks for your interest. This document covers what is accepted, what is not, and how to work
on the code.

## What is **not** accepted

Closed without discussion — it is not personal, it is what keeps the project viable:

- Requests for ROMs, BIOS files, or links to them.
- Pull requests adding downloading, searching, or indexing of game content.
- Any game file in the repository, **including as a test fixture**.

Fixtures are generated in code (a synthetic header plus predictable bytes already exercises the
whole detection path).

## Adding support for a console

This is the easiest way to contribute, and it does not require writing TypeScript.

1. Create `data/systems/<id>.json`. The filename must match the `id` field.
2. Fill it in following the fields documented in
   [`packages/core/src/systems/types.ts`](packages/core/src/systems/types.ts).
3. Run `pnpm test` — the suite validates every rule pack in the repository.

Minimal example:

```json
{
  "id": "my-console",
  "name": "My Console",
  "manufacturer": "Manufacturer",
  "extensions": ["ext"],
  "defaultTemplate": "{title} ({region}){revision}.{ext}"
}
```

If the console has a header (bytes the DATs do not count) or byte order variants, declare
`header` / `byteOrder`. In the pull request description, say **where the information came from** —
the header signature, its size, the source. That is what makes review possible without owning
the hardware.

## Working on the code

```bash
corepack enable pnpm
pnpm install
```

Before opening a pull request:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

### Where things go

- **`packages/core`** — all identification logic. Plain Node: no `electron`, no DOM.
  New code here ships with a test.
- **`apps/desktop/src/main`** — the only place with disk access. No destructive operation
  bypasses the dry run and the journal.
- **`apps/desktop/src/renderer`** — UI only. It talks to main through `preload`, never to `fs`.

### Conventions

- **Code in English** (function, variable, and file names). **Inline comments and UI strings are
  in Brazilian Portuguese** — this is a Brazilian-maintained project and the existing code follows
  that; match the surrounding style rather than mixing languages in a file.
- Comments explain _why_, not _what_.
- No TypeScript `enum` and no parameter properties: they break Node's type stripping, and with it
  the ability to run the core and the CLI without a build step. ESLint enforces this.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

  ```
  feat(n64): detect v64 byte order before hashing
  fix(snes): skip header stripping when size is not a multiple of 1024
  ```

## Releasing

There are no tags to create by hand. **The version in `apps/desktop/package.json` decides**:
a push to `main` publishes a release if that version does not have one yet.

To cut a release:

1. Bump the version in `apps/desktop/package.json` and `package.json` — the workflow fails
   if the two disagree, so a release never goes out with an ambiguous number.
2. Write `changelog/<version>.en.md`, and `changelog/<version>.pt-BR.md` if you can. The
   English file is **required**: the workflow refuses to publish without it, because that text
   becomes the release body.
3. Push to `main`.

Write the notes for whoever will use the app, not for whoever wrote the code. Say what changed
for them; leave refactors, test changes and internal cleanups out.

## Reporting a misidentified file

This is the most useful kind of issue. Include:

- System and file extension.
- Size in bytes and CRC32 (`crc32 file.nes` or equivalent).
- The name the app proposed and the name you expected.

**Do not attach the file.** Size and hash are enough to reproduce.
