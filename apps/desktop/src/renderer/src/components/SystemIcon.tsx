interface Props {
  /** Data URI do ícone, ou `null` quando não há. */
  source: string | null
  className?: string
}

/**
 * Ícone do console.
 *
 * Os PNGs do RetroArch são monocromáticos brancos sobre transparente — `opacity` os integra ao
 * fundo escuro sem precisar reprocessá-los. Sem ícone, um espaço vazio do mesmo tamanho mantém
 * o alinhamento da lista: não ter o arquivo não pode desalinhar as linhas.
 */
export function SystemIcon({ source, className = 'size-6' }: Props) {
  if (source === null) return <span className={className} aria-hidden="true" />

  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`${className} object-contain opacity-80`}
    />
  )
}
