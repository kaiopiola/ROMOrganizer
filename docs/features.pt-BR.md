# Funcionalidades

_[English](features.md)_

O que o app faz, e por que faz assim. Para a versão curta, veja o
[README](../README.pt-BR.md).

---

## Bibliotecas

Uma biblioteca é uma pasta vinculada a um console. É todo o modelo: você aponta onde ficam as
ROMs de cada sistema, e daí em diante tudo acontece por biblioteca.

Cada uma guarda a própria configuração — qual base usar, o padrão de nomes, se inclui subpastas.
Um console que precisa de um DAT local não impõe essa escolha aos outros. Bibliotecas novas
partem do que você escolheu por último, então dez consoles não significam dez configurações do
zero.

Tudo que o app grava sobre uma coleção fica dentro da própria coleção, em `.romorg/`: o cache de
hashes, os journals de desfazer e o último resultado de identificação. Mova a pasta e o
histórico vai junto.

---

## Identificação

É o núcleo do projeto. Adivinhar o jogo pelo nome do arquivo é o que faz as outras ferramentas
errarem, então aqui o nome é o **último** recurso — e a interface sempre mostra qual caminho foi
usado.

A ordem:

1. **Hash contra o DAT.** CRC32, MD5 e SHA1 são calculados numa passada só. O hash mais forte
   disponível vence, porque colisão de CRC32 é rara mas real numa base de centenas de milhares
   de entradas.
2. **Hash com o header descontado.** DATs No-Intro são _headerless_: um `.nes` com cabeçalho
   iNES (16 bytes) ou um `.smc` com header SMC (512 bytes) nunca bate se hasheado cru. As duas
   variantes são calculadas na mesma leitura, então funciona com DAT que inclui o header e com
   DAT que não inclui — você não precisa saber qual importou.
3. **Normalização de byte order.** `.z64`, `.v64` e `.n64` são o mesmo dump com os bytes
   trocados. O arquivo é normalizado antes de hashear, então um `.v64` bate com um DAT em `.z64`.
4. **Heurística de nome.** As convenções No-Intro e GoodTools são interpretadas, mas o resultado
   é marcado como palpite e **não** é renomeado sem você pedir explicitamente.

### Arquivos compactados

ROMs dentro de `.zip` são tratadas — e normalmente **sem descomprimir nada**. O formato zip já
guarda o CRC32 do conteúdo descomprimido de cada entrada, o que basta para identificar a maior
parte de uma coleção. A descompressão só acontece quando esse atalho falha, o que na prática
significa header a descontar ou byte order a normalizar.

### Quando os DATs discordam

O mesmo hash pode existir em mais de um DAT com nomes diferentes. Os dois candidatos aparecem,
a linha é marcada como ambígua, e nada é aplicado até você decidir.

---

## Bases de dados

- **libretro-database** — baixado sob demanda e guardado em cache. Para os sistemas que têm as
  duas, as coleções `no-intro` e `headered` são buscadas juntas, que é o que faz um `.nes` bater
  de qualquer forma.
- **Seus próprios DATs** — arquivos do No-Intro ou Redump que você mantém. Os dois dialetos são
  suportados: Logiqx XML e clrmamepro.

As duas escolhas são por biblioteca. O cache cai para uma cópia vencida quando a rede está fora,
porque um DAT de semana passada identifica muito mais que DAT nenhum.

---

## Renomeação

Nada é escrito antes de você aprovar.

**Todo lote é um plano que você revisa antes.** O plano mostra o que vai acontecer e, para tudo
que ficou de fora, o motivo:

| Motivo                    | O que significa                                     |
| ------------------------- | --------------------------------------------------- |
| já está certo             | o arquivo já está onde e como deveria               |
| sem nome a propor         | nada casou e o nome não diz nada                    |
| DATs discordam            | mais de um candidato, e escolher um seria adivinhar |
| nome já ocupado           | outro arquivo já está no destino                    |
| dois arquivos, mesmo nome | duas origens disputam um destino                    |

Dá para escolher linha a linha ou aplicar tudo.

### Desfazer

**Todo lote pode ser desfeito.** O journal é gravado durante a execução, com flush a cada linha —
então nem uma queda no meio do caminho tira o desfazer de você. O undo roda na ordem inversa,
porque um lote pode mover A para o nome que B acabou de liberar.

O executor também se recusa a sobrescrever. O `fs.rename` substituiria o destino em silêncio, o
que numa coleção de ROMs significa apagar um arquivo sem aviso.

### Padrão de nomes

O padrão é seu. `{region}/{title}.{ext}` coloca cada jogo numa pasta por região;
`{title} [({region})].{ext}` apenas renomeia.

- `[ ... ]` marca um grupo opcional — ele some inteiro quando um token dentro dele está vazio,
  então região desconhecida dá `Jogo.nes` e não `Jogo ().nes`
- `/` cria subpastas, contadas **a partir da raiz da biblioteca** — senão um scan recursivo
  aninharia mais um nível a cada execução
- Tokens disponíveis: `title`, `region`, `regions`, `language`, `revision`, `year`, `system`,
  `manufacturer`, `letter`, `ext`

O preview acompanha o que você digita, e é produzido pelo mesmo código que faz o trabalho — não
é uma aproximação.

O padrão é salvo por console, então a próxima biblioteca do mesmo sistema já começa configurada.

### Quarentena

Arquivos não identificados podem ser movidos para uma pasta à sua escolha. O nome é preservado:
o arquivo muda de lugar, não de identidade. Nada é apagado.

---

## Auditoria

Compara a coleção com o que os DATs listam.

- **Tenho / faltando**, com percentual de completude
- **Filtro por região** — o que torna útil auditar um set 1G1R; sem ele, um set USA/Europe mostra
  todo lançamento japonês como faltante
- **Protótipos e betas ficam de fora por padrão**, já que quem pergunta "o que falta" raramente
  conta um beta que nunca saiu
- **Duplicados** — o mesmo jogo presente mais de uma vez
- **Não reconhecidos** — arquivos que nenhum DAT reivindica, que é onde moram dumps ruins, hacks
  e traduções
- Exporta em **CSV** ou **Markdown**

A auditoria trabalha sobre um scan já feito; não relê disco.

---

## Playlists

Por plataforma, na tela de Playlists.

- **`.lpl` do RetroArch** com o nome de base correto, que é o que liga as entradas às capas
- Conteúdo dentro de zip é apontado como `arquivo.zip#entrada`, a forma que o RetroArch entende
- **Jogos em vários discos viram `.m3u`** e aparecem como uma entrada só — listar `Disc 1` e
  `Disc 2` ao lado do `.m3u` devolveria a bagunça que o agrupamento existe para resolver
- Só entra o que casou com um DAT: playlist é lista de jogos, não de nomes de arquivo

---

## Fila

Identificar e renomear passam por uma fila, **um trabalho por vez**. É deliberado: os dois são
operações de disco, e rodar várias bibliotecas em paralelo disputa o mesmo disco — costuma
deixar o total mais lento e o progresso ilegível.

Enfileire tudo e saia de perto. A barra do rodapé mostra o que está rodando e quantos esperam;
a tela da Fila separa ativos de concluídos e guarda o motivo do que falhou. Qualquer trabalho
pode ser cancelado — na fila ele nem começa, em execução quem interrompe é o processo principal,
e um lote cancelado ainda deixa o journal para desfazer.

---

## Desempenho

- **Cache de hashes** junto da coleção, indexado por tamanho e mtime. Um segundo scan não relê o
  que não mudou. O cache guarda **hashes**, não resultados de identificação, então trocar ou
  atualizar um DAT não invalida nada — a consulta ao índice é barata e é sempre refeita.
- **O atalho do CRC do zip** descrito acima.
- **O último scan é salvo**, então abrir uma biblioteca já identificada mostra o resultado na
  hora, em vez de uma tela vazia. Ele é revalidado ao carregar: arquivos que sumiram são
  descartados e você é avisado.

---

## Interface

- Inglês e português, seguindo o sistema ou escolhido manualmente
- Ícones de console vindos dos assets do RetroArch, baixados sob demanda
- Tabela virtualizada, já que uma coleção de console passa de dez mil arquivos com facilidade
- Tela de configurações com preferências, notas de versão e verificação de atualização

---

## Atualizações

- **Windows e Linux** — o app instala as atualizações sozinho
- **macOS** — ele detecta a versão nova e abre a página do release. O Squirrel.Mac recusa aplicar
  atualização a um app não assinado, e este projeto distribui sem certificado, então a instalação
  automática é impossível. A interface diz isso em vez de oferecer um botão que falha.

---

## Fora do escopo, de propósito

- Não baixa, não busca e não indexa conteúdo de jogo
- Nada é apagado — a ação mais forte é mover um arquivo
- Nada é escrito em disco sem um plano que você aprovou antes
