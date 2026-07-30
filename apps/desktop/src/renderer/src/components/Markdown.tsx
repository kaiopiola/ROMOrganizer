import { useMemo } from 'react'

/**
 * Render de Markdown suficiente para as notas de versão.
 *
 * Sem biblioteca: o conteúdo é escrito neste repositório, então a superfície é conhecida —
 * títulos, listas, ênfase, código e uma linha divisória. Trazer um parser completo custaria
 * mais que o que ele resolveria, e a maior parte do que ele traz (HTML embutido, tabelas,
 * links arbitrários) é justamente o que não queremos executar aqui.
 */
interface Props {
  source: string
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'rule' }

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.split('\n')

  let paragraph: string[] = []
  let list: string[] = []

  function flush(): void {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
      paragraph = []
    }
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list })
      list = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === '') {
      flush()
      continue
    }
    if (trimmed === '---') {
      flush()
      blocks.push({ kind: 'rule' })
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flush()
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]! })
      continue
    }

    const item = /^[-*]\s+(.*)$/.exec(trimmed)
    if (item) {
      if (paragraph.length > 0) flush()
      list.push(item[1]!)
      continue
    }

    // Continuação de item: a lista segue, com o texto emendado na última entrada.
    if (list.length > 0 && /^\s{2,}/.test(line)) {
      list[list.length - 1] = `${list[list.length - 1]} ${trimmed}`
      continue
    }

    paragraph.push(trimmed)
  }

  flush()
  return blocks
}

/** Aplica ênfase e código, produzindo nós React — nunca HTML cru. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g

  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))

    const token = match[0]
    key += 1

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-neutral-100">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(
        <em key={key} className="text-neutral-400">
          {token.slice(1, -1)}
        </em>,
      )
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function Markdown({ source }: Props) {
  const blocks = useMemo(() => parseBlocks(source), [source])

  return (
    <div className="text-sm leading-relaxed text-neutral-300">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <p
                key={index}
                className={
                  block.level <= 2
                    ? 'mt-5 mb-2 text-base font-semibold text-neutral-100 first:mt-0'
                    : 'mt-4 mb-1 text-sm font-semibold text-neutral-200'
                }
              >
                {renderInline(block.text)}
              </p>
            )
          case 'list':
            return (
              <ul key={index} className="my-2 list-disc space-y-1 pl-5 marker:text-neutral-600">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'rule':
            return <hr key={index} className="my-5 border-neutral-800" />
          default:
            return (
              <p key={index} className="my-2">
                {renderInline(block.text)}
              </p>
            )
        }
      })}
    </div>
  )
}
