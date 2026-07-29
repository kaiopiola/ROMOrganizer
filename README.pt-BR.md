# ROMOrganizer

_[English](README.md)_

Ferramenta desktop de código aberto que **organiza a coleção de ROMs que você já tem**.
Ela identifica cada arquivo pelo hash, descobre título e região, e renomeia — em vez de chutar
pelo nome do arquivo.

> **Bring your own files.** O ROMOrganizer não baixa, não busca e não distribui ROMs.
> Ele só trabalha sobre arquivos que já estão no seu disco.

## Estado

Em desenvolvimento — **Fase 0 (fundação)** concluída. Ainda não há release utilizável.

## Como funciona

Adivinhar a ROM pelo nome do arquivo é justamente o que faz as outras ferramentas errarem.
A ordem aqui é:

1. **Hash contra DAT** (CRC32/SHA1) — a fonte de verdade.
2. **Hash com o header descontado**, porque os DATs No-Intro são _headerless_: um `.nes` com
   cabeçalho iNES (16 bytes) ou um `.smc` com header SMC (512 bytes) nunca bate o CRC se
   hasheado cru.
3. **Normalização de byte order**, para o N64 (`.z64` / `.v64` / `.n64` são o mesmo dump com
   os bytes trocados).
4. **Heurística de nome** — só como último recurso, e sinalizada como tal na interface.

Nada muda sem você revisar: todo lote passa por **dry-run**, e toda execução grava um journal
que permite **desfazer**.

ROMs dentro de `.zip` também são tratadas — e normalmente sem descomprimir nada, já que o
formato zip guarda o CRC32 do conteúdo descomprimido de cada entrada.

## Bases de dados

- **libretro-database** — baixado sob demanda, versionado e atualizável. Para sistemas que
  têm as duas, as coleções `no-intro` e `headered` são buscadas juntas — é o que faz um `.nes`
  bater venha ele com header ou sem.
- **Importação manual** de DATs do No-Intro / Redump, para quem mantém sets exatos.

Os dois dialetos de DAT são suportados: Logiqx XML (No-Intro) e clrmamepro (libretro-database).

## Desenvolvimento

Requer Node 22+ e pnpm (via `corepack enable pnpm`).

```bash
pnpm install
```

```bash
pnpm dev
```

Outros comandos:

| Comando          | O que faz                             |
| ---------------- | ------------------------------------- |
| `pnpm test`      | Testes do núcleo (Vitest)             |
| `pnpm typecheck` | Checagem de tipos em todos os pacotes |
| `pnpm lint`      | ESLint                                |
| `pnpm build`     | Build de todos os pacotes             |

O CLI roda direto do código-fonte, sem build:

```bash
node packages/cli/src/index.ts scan ~/roms/snes --system snes --libretro
```

### Estrutura

| Caminho         | Papel                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| `packages/core` | Identificação de ROMs. Node puro, sem Electron — é onde mora a lógica. |
| `packages/cli`  | Interface headless sobre o core.                                       |
| `apps/desktop`  | App Electron: processo main (disco, banco), preload e renderer React.  |
| `data/systems`  | Rule packs por console, em JSON — a via de contribuição mais fácil.    |

O `core` é deliberadamente independente do Electron: dá para testá-lo em milissegundos e
contribuir com ele sem abrir o app.

## Contribuindo

Adicionar suporte a um console é um PR de **um arquivo JSON** em `data/systems/` mais um teste.
Veja o [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md).

## Escopo legal

- A ferramenta opera sobre arquivos **que já estão no disco do usuário**.
- Não baixa ROMs, não faz busca, não indexa fontes e não aceita links para elas.
- Os DATs usados são **metadados** (nome, hash, região) — nunca conteúdo de jogo. Os que vêm do
  [libretro-database](https://github.com/libretro/libretro-database) estão sob CC BY-SA 4.0 e são
  baixados sob demanda pelo usuário, não redistribuídos com o app.
- Nenhuma ROM, BIOS ou header proprietário entra neste repositório, **incluindo fixtures de
  teste**, que são geradas sinteticamente.
- Issues e PRs pedindo ou oferecendo ROMs são fechados sem discussão.

## Licença

[GPL-3.0-or-later](LICENSE).
