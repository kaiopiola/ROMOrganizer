import { useEffect, useMemo, useState } from 'react'
import { buildRelativePath, TEMPLATE_TOKENS, TemplateError } from '@romorg/core/browser'
import { t } from '../i18n.ts'

/** Exemplo fixo, para o preview mostrar sempre a mesma coisa e ser comparável. */
const SAMPLE_TOKENS = {
  title: 'Super Test Bros.',
  region: 'USA',
  regions: 'USA, Europe',
  language: 'en',
  revision: 'Rev A',
  year: '1991',
  system: 'Super Nintendo Entertainment System',
  manufacturer: 'Nintendo',
  letter: 'S',
  ext: 'sfc',
}

/** Pontos de partida comuns, para o usuário não ter que descobrir a sintaxe do zero. */
const PRESETS = [
  '{title}[ ({region})].{ext}',
  '{region}/{title}.{ext}',
  '{letter}/{title}[ ({region})].{ext}',
  '{region}/{year}/{title}.{ext}',
]

interface Props {
  value: string
  /** Chamado só quando a edição termina — ver a nota sobre `draft` abaixo. */
  onCommit: (value: string) => void
  /** Template padrão do sistema, usado quando o campo está vazio. */
  systemDefault: string
}

/**
 * Editor do padrão de nomes.
 *
 * O preview é calculado com a mesma função que o main usa para valer — não é uma imitação —
 * então o que aparece aqui é literalmente o formato que o plano vai propor.
 */
export function TemplateEditor({ value, onCommit, systemDefault }: Props) {
  /**
   * Rascunho local.
   *
   * O preview acompanha cada tecla, mas gravar só acontece ao terminar a edição: cada commit
   * persiste em disco e invalida o scan em tela, e fazer isso a cada caractere significaria
   * o usuário ver a lista de arquivos sumir enquanto digita.
   */
  const [draft, setDraft] = useState(value)

  // Trocar de biblioteca traz outro template — o rascunho precisa acompanhar.
  useEffect(() => setDraft(value), [value])

  function commit(next: string): void {
    setDraft(next)
    if (next !== value) onCommit(next)
  }

  const effective = draft.trim() === '' ? systemDefault : draft

  const preview = useMemo(() => {
    try {
      const path = buildRelativePath(effective, SAMPLE_TOKENS)
      return { path, error: null }
    } catch (cause) {
      return {
        path: null,
        error: cause instanceof TemplateError ? cause.message : String(cause),
      }
    }
  }, [effective])

  // O mesmo template com um token faltando: é onde os grupos opcionais provam o valor deles.
  const previewWithoutRegion = useMemo(() => {
    try {
      return buildRelativePath(effective, { ...SAMPLE_TOKENS, region: undefined, year: undefined })
    } catch {
      return null
    }
  }, [effective])

  function insertToken(token: string): void {
    commit(`${draft === '' ? systemDefault : draft}{${token}}`)
  }

  return (
    <section className="rounded-lg border border-neutral-800">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h2 className="text-sm font-medium">{t.templateTitle}</h2>
        <p className="text-xs text-neutral-500">{t.templateHint}</p>
      </header>

      <div className="flex flex-col gap-3 px-4 py-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setDraft(value)
          }}
          placeholder={systemDefault}
          spellCheck={false}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-600"
        />

        <div className="flex flex-wrap gap-1">
          {TEMPLATE_TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => insertToken(token)}
              title={t.tokenHint(token)}
              className="rounded border border-neutral-700 px-2 py-0.5 font-mono text-xs text-neutral-400 hover:border-emerald-700 hover:text-emerald-300"
            >
              {`{${token}}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-500">{t.templatePresets}</span>
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => commit(preset)}
              className={`rounded border px-2 py-0.5 font-mono ${
                effective === preset
                  ? 'border-emerald-700 text-emerald-300'
                  : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="rounded-md bg-neutral-900/70 px-3 py-2 text-sm">
          {preview.error !== null ? (
            <p className="text-red-400">{preview.error}</p>
          ) : (
            <>
              <p className="font-mono text-emerald-300">{preview.path}</p>
              {previewWithoutRegion !== null && previewWithoutRegion !== preview.path && (
                <p className="mt-1 font-mono text-xs text-neutral-500">
                  {t.templatePreviewMissing}: {previewWithoutRegion}
                </p>
              )}
            </>
          )}
        </div>

        {effective.includes('/') && (
          <p className="text-xs text-amber-400">{t.templateMovesFiles}</p>
        )}
      </div>
    </section>
  )
}
