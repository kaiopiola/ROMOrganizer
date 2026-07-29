# Contribuindo com o ROMOrganizer

_[English](CONTRIBUTING.md)_

Obrigado pelo interesse. Este documento cobre o que é aceito, o que não é, e como mexer no código.

## O que **não** é aceito

Fechamos sem discussão, e não é pessoal — é o que mantém o projeto viável:

- Pedidos de ROMs, BIOS ou links para elas.
- PRs que adicionem download, busca ou indexação de conteúdo de jogo.
- Qualquer arquivo de jogo no repositório, **inclusive como fixture de teste**.

Fixtures são geradas em código (um header sintético + bytes previsíveis já exercitam toda a
lógica de detecção).

## Adicionando suporte a um console

Esse é o caminho mais fácil de contribuir e não exige escrever TypeScript.

1. Crie `data/systems/<id>.json`. O nome do arquivo precisa ser igual ao campo `id`.
2. Preencha conforme os campos documentados em
   [`packages/core/src/systems/types.ts`](packages/core/src/systems/types.ts).
3. Rode `pnpm test` — a suíte valida todos os rule packs do repositório.

Exemplo mínimo:

```json
{
  "id": "meu-console",
  "name": "Meu Console",
  "manufacturer": "Fabricante",
  "extensions": ["ext"],
  "defaultTemplate": "{title} ({region}){revision}.{ext}"
}
```

Se o console tiver header (bytes que os DATs não contam) ou variantes de byte order, declare
`header` / `byteOrder`. Explique na descrição do PR **de onde veio a informação** — a assinatura
do header, o tamanho, a fonte. Isso é o que permite revisar sem ter o hardware.

## Mexendo no código

```bash
corepack enable pnpm
pnpm install
```

Antes de abrir o PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

### Onde colocar o quê

- **`packages/core`** — toda a lógica de identificação. Node puro: sem `electron`, sem DOM.
  Código novo aqui entra com teste.
- **`apps/desktop/src/main`** — único lugar com acesso a disco. Nenhuma operação destrutiva
  sem passar pelo dry-run e pelo journal.
- **`apps/desktop/src/renderer`** — só UI. Conversa com o main pelo `preload`, nunca com `fs`.

### Convenções

- **Código em inglês** (nomes de função, variável, arquivo); **comentários e UI em português**.
- Comentário explica _por quê_, não _o quê_.
- Nada de `enum` nem parameter properties do TypeScript: quebram o type stripping do Node, e
  com ele a possibilidade de rodar o core e o CLI sem build. O ESLint barra.
- Commits em [Conventional Commits](https://www.conventionalcommits.org/), com a descrição em
  português no imperativo:

  ```
  feat(n64): detectar byte order v64 antes do hash
  fix(snes): não descontar header quando o tamanho não é múltiplo de 1024
  ```

## Reportando um erro de identificação

É o tipo de issue mais útil. Inclua:

- Sistema e extensão do arquivo.
- Tamanho em bytes e CRC32 (`crc32 arquivo.nes` ou equivalente).
- O nome que o app propôs e o que você esperava.

**Não anexe o arquivo.** Tamanho e hash bastam para reproduzir.
