import { useMemo, useRef, useState } from 'react'
import type { IdentificationMethod } from '@romorg/core'
import type { ScanRow } from '../../../main/ipc-types.ts'
import { t } from '../i18n.ts'

const METHOD_LABEL: Record<IdentificationMethod, string> = {
  hash: t.methodHash,
  'hash-headerless': t.methodHashHeaderless,
  filename: t.methodFilename,
  unidentified: t.methodUnidentified,
}

const METHOD_TITLE: Record<IdentificationMethod, string> = {
  hash: t.methodHashTitle,
  'hash-headerless': t.methodHashHeaderlessTitle,
  filename: t.methodFilenameTitle,
  unidentified: t.methodUnidentifiedTitle,
}

/**
 * Cor por confiabilidade, não por estética: verde é hash (certeza), âmbar é palpite pelo
 * nome, cinza é desistência. É a informação que decide se vale aprovar um lote inteiro.
 */
const METHOD_STYLE: Record<IdentificationMethod, string> = {
  hash: 'bg-emerald-950 text-emerald-300 border-emerald-900',
  'hash-headerless': 'bg-emerald-950 text-emerald-300 border-emerald-900',
  filename: 'bg-amber-950 text-amber-300 border-amber-900',
  unidentified: 'bg-neutral-800 text-neutral-400 border-neutral-700',
}

const ROW_HEIGHT = 40
const OVERSCAN = 12

interface Props {
  rows: ScanRow[]
}

/**
 * Tabela virtualizada.
 *
 * Uma coleção de console passa de 10 mil arquivos com facilidade; renderizar tudo trava a
 * janela. A janela visível é calculada na mão porque o requisito aqui é só altura fixa de
 * linha — não vale trazer uma dependência para isso.
 */
export function ScanTable({ rows }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(480)

  const { start, end } = useMemo(() => {
    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const visible = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2
    return { start: first, end: Math.min(rows.length, first + visible) }
  }, [scrollTop, viewportHeight, rows.length])

  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-widest text-neutral-500 uppercase">
        {t.scanTitle} · {rows.length}
      </h2>

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <div className="grid grid-cols-[2fr_1fr_2fr] gap-4 border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-xs font-medium text-neutral-400">
          <span>{t.colFile}</span>
          <span>{t.colMethod}</span>
          <span>{t.colProposed}</span>
        </div>

        <div
          ref={containerRef}
          onScroll={(event) => {
            setScrollTop(event.currentTarget.scrollTop)
            setViewportHeight(event.currentTarget.clientHeight)
          }}
          className="max-h-[420px] overflow-y-auto"
        >
          <div style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
            <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
              {rows.slice(start, end).map((row) => (
                <div
                  key={row.id}
                  style={{ height: ROW_HEIGHT }}
                  className="grid grid-cols-[2fr_1fr_2fr] items-center gap-4 border-b border-neutral-900 px-4 text-sm"
                >
                  <span className="truncate" title={row.fileName}>
                    {row.fileName}
                    {row.archiveEntry !== null && (
                      <span className="text-neutral-500"> › {row.archiveEntry}</span>
                    )}
                  </span>

                  <span className="flex items-center gap-1">
                    <span
                      title={METHOD_TITLE[row.method]}
                      className={`rounded border px-1.5 py-0.5 text-xs ${METHOD_STYLE[row.method]}`}
                    >
                      {METHOD_LABEL[row.method]}
                    </span>
                    {row.fromArchiveIndex && (
                      <span title={t.fromZipTitle} className="text-xs text-neutral-500">
                        {t.fromZip}
                      </span>
                    )}
                  </span>

                  <span className="truncate" title={row.proposedName ?? undefined}>
                    {row.proposedName ?? <span className="text-neutral-600">{t.noProposal}</span>}
                    {row.ambiguous && (
                      <span
                        title={row.candidates.join(' | ')}
                        className="ml-2 rounded border border-amber-900 bg-amber-950 px-1.5 py-0.5 text-xs text-amber-300"
                      >
                        {t.ambiguous}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
