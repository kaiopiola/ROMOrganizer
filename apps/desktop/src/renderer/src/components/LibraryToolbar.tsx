import type { Library } from '../../../main/libraries.ts'
import { t } from '../i18n.ts'

interface Props {
  library: Library
  disabled: boolean
  onChanged: () => Promise<void>
}

/**
 * Ajustes da biblioteca aberta.
 *
 * Ficam aqui, e não na lista lateral, porque são ações sobre a pasta **que está aberta** —
 * na lista competiam com a função de escolher qual abrir, e desvincular ficava a um clique
 * de distância de selecionar.
 */
export function LibraryToolbar({ library, disabled, onChanged }: Props) {
  return (
    <section className="flex flex-wrap items-center gap-4 border-b border-neutral-800 pb-4">
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={library.recursive}
          disabled={disabled}
          onChange={async (event) => {
            await window.romorg.libraries.update(library.id, { recursive: event.target.checked })
            await onChanged()
          }}
        />
        {t.recursive}
      </label>

      <button
        type="button"
        onClick={() => void window.romorg.libraries.reveal(library.id)}
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        {t.revealLibrary}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={async () => {
          await window.romorg.libraries.remove(library.id)
          await onChanged()
        }}
        className="ml-auto text-sm text-neutral-500 hover:text-red-400 disabled:opacity-40"
      >
        {t.removeLibrary}
      </button>
    </section>
  )
}
