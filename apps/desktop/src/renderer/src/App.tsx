import { useEffect, useState } from 'react'
import type { SystemRulePack } from '@romorg/core'

export function App() {
  const [systems, setSystems] = useState<SystemRulePack[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.romorg
      .listSystems()
      .then(setSystems)
      .catch((cause: unknown) => setError(String(cause)))
  }, [])

  return (
    <main className="min-h-screen bg-neutral-950 p-10 text-neutral-100">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">ROMOrganizer</h1>
        <p className="text-sm text-neutral-400">Sua coleção com os nomes certos, na pasta certa.</p>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-widest text-neutral-500 uppercase">
          Sistemas suportados
        </h2>

        {error !== null && <p className="text-sm text-red-400">Falha ao carregar: {error}</p>}
        {error === null && systems === null && (
          <p className="text-sm text-neutral-500">Carregando…</p>
        )}

        {systems !== null && (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((system) => (
              <li key={system.id} className="rounded-lg border border-neutral-800 p-3">
                <p className="font-medium">{system.name}</p>
                <p className="text-xs text-neutral-500">
                  {system.manufacturer} · {system.extensions.map((ext) => `.${ext}`).join(' ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
