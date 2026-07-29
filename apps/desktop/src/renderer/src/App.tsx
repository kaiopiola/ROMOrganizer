import { useCallback, useEffect, useState } from 'react'
import type { SystemRulePack } from '@romorg/core/browser'
import type { Library } from '../../main/libraries.ts'
import type {
  ApplyProgress,
  ApplyResultDto,
  JournalSummary,
  PlanDto,
  ScanProgress,
  ScanSummaryDto,
} from '../../main/ipc-types.ts'
import { t } from './i18n.ts'
import { LibrarySidebar } from './components/LibrarySidebar.tsx'
import { ScanTable } from './components/ScanTable.tsx'
import { PlanPanel } from './components/PlanPanel.tsx'
import { HistoryPanel } from './components/HistoryPanel.tsx'
import { TemplateEditor } from './components/TemplateEditor.tsx'
import { LibraryToolbar } from './components/LibraryToolbar.tsx'

export function App() {
  const [systems, setSystems] = useState<SystemRulePack[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const [scan, setScan] = useState<ScanSummaryDto | null>(null)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [applyProgress, setApplyProgress] = useState<ApplyProgress | null>(null)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [journals, setJournals] = useState<JournalSummary[]>([])

  const [useLibretro, setUseLibretro] = useState(true)
  const [localDatPaths, setLocalDatPaths] = useState<string[]>([])
  const [includeFilenameMatches, setIncludeFilenameMatches] = useState(false)
  const [allowAmbiguous, setAllowAmbiguous] = useState(false)

  const [busy, setBusy] = useState<'scanning' | 'applying' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const active = libraries.find((library) => library.id === activeId) ?? null
  const activeSystem = systems.find((system) => system.id === active?.systemId) ?? null

  useEffect(() => {
    void window.romorg.listSystems().then(setSystems)
    void window.romorg.libraries.list().then(setLibraries)

    const offScan = window.romorg.scan.onProgress(setProgress)
    const offApply = window.romorg.plan.onProgress(setApplyProgress)
    return () => {
      offScan()
      offApply()
    }
  }, [])

  const refreshJournals = useCallback(async (libraryId: string) => {
    setJournals(await window.romorg.journals.list(libraryId))
  }, [])

  // Trocar de biblioteca zera o que era da anterior: mostrar um plano de outra pasta seria
  // a forma mais fácil de o usuário aplicar a coisa errada.
  useEffect(() => {
    setScan(null)
    setPlan(null)
    setProgress(null)
    setNotice(null)
    if (activeId !== null) void refreshJournals(activeId)
    else setJournals([])
  }, [activeId, refreshJournals])

  const template = active?.template ?? ''
  const quarantineDirectory = active?.quarantineDirectory ?? ''
  const planOptions = { includeFilenameMatches, allowAmbiguous, template, quarantineDirectory }

  /** Ids escolhidos para aplicar. `null` significa "todos do plano". */
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)

  /**
   * Trocar o padrão de nomes não descarta o scan.
   *
   * Identificar custa hash de disco inteiro; o nome proposto sai de dados já em memória. O
   * main recalcula os dois — linhas e plano — e devolve juntos, para a tabela nunca mostrar
   * um nome diferente do que o plano fará.
   */
  async function updateQuarantine(next: string): Promise<void> {
    if (active === null) return
    await window.romorg.libraries.update(active.id, { quarantineDirectory: next })
    setLibraries(await window.romorg.libraries.list())
  }

  async function updateTemplate(next: string): Promise<void> {
    if (active === null) return
    await window.romorg.libraries.update(active.id, { template: next })
    setLibraries(await window.romorg.libraries.list())
  }

  async function withErrorHandling(action: () => Promise<void>): Promise<void> {
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function runScan(): Promise<void> {
    if (active === null) return
    setBusy('scanning')
    setNotice(null)
    await withErrorHandling(async () => {
      const summary = await window.romorg.scan.start(active.id, { useLibretro, localDatPaths })
      const result = await window.romorg.plan.build(active.id, planOptions)
      setScan({ ...summary, rows: result.rows })
      setPlan(result.plan)
    })
    setBusy(null)
    setProgress(null)
  }

  // Extraído para o ESLint conseguir checar a dependência estaticamente.
  const hasScan = scan !== null

  // O plano é recalculado no main a cada mudança de opção — a interface nunca decide sozinha
  // o que vai para o disco.
  useEffect(() => {
    if (active === null || scan === null) return
    void window.romorg.plan.build(active.id, planOptions).then((result) => {
      setPlan(result.plan)
      setScan((current) => (current === null ? null : { ...current, rows: result.rows }))
      // Um plano novo pode não conter os ids escolhidos antes; voltar para "todos" é o
      // comportamento seguro — o usuário vê a contagem e decide de novo.
      setSelectedIds(null)
    })
    // `scan` fora das dependências de propósito: este efeito o atualiza, e incluí-lo
    // criaria um laço infinito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeFilenameMatches, allowAmbiguous, template, quarantineDirectory, activeId, hasScan])

  async function applyPlan(): Promise<void> {
    if (active === null || plan === null || plan.operations.length === 0) return

    // A confirmação é do main: ele mostra o diálogo nativo e só então escreve.
    setBusy('applying')
    setApplyProgress(null)
    await withErrorHandling(async () => {
      const result: ApplyResultDto = await window.romorg.plan.apply(
        active.id,
        planOptions,
        selectedIds === null ? null : [...selectedIds],
      )
      setNotice(result.cancelled ? t.appliedPartial(result.applied) : t.applied(result.applied))
      if (result.failed.length > 0) {
        setError(result.failed.map((failure) => failure.reason).join('\n'))
      }
      await refreshJournals(active.id)
      // Reidentifica: depois do rename, os nomes em tela não valem mais.
      const summary = await window.romorg.scan.start(active.id, { useLibretro, localDatPaths })
      const rebuilt = await window.romorg.plan.build(active.id, planOptions)
      setScan({ ...summary, rows: rebuilt.rows })
      setPlan(rebuilt.plan)
    })
    setBusy(null)
    setApplyProgress(null)
  }

  async function undo(journalPath: string): Promise<void> {
    if (active === null) return
    await withErrorHandling(async () => {
      const result = await window.romorg.journals.undo(journalPath)
      setNotice(t.undone(result.restored))
      if (result.failed.length > 0) {
        setError(result.failed.map((failure) => failure.reason).join('\n'))
      }
      await refreshJournals(active.id)
      const summary = await window.romorg.scan.start(active.id, { useLibretro, localDatPaths })
      const rebuilt = await window.romorg.plan.build(active.id, planOptions)
      setScan({ ...summary, rows: rebuilt.rows })
      setPlan(rebuilt.plan)
    })
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <LibrarySidebar
        systems={systems}
        libraries={libraries}
        activeId={activeId}
        onSelect={setActiveId}
        onChanged={async () => setLibraries(await window.romorg.libraries.list())}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header
          className={`border-b border-neutral-800 px-8 ${
            window.romorg.platform === 'darwin' ? 'pt-9 pb-5' : 'py-5'
          }`}
        >
          <h1 className="text-lg font-semibold">{active?.directory ?? t.appName}</h1>
          <p className="text-sm text-neutral-400">
            {active === null ? t.tagline : (activeSystem?.name ?? active.systemId)}
          </p>
        </header>

        {active === null ? (
          <div className="flex flex-1 items-center justify-center px-8 text-center">
            <p className="max-w-md text-sm text-neutral-500">{t.librariesEmpty}</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 py-6">
            <LibraryToolbar
              library={active}
              disabled={busy !== null}
              onChanged={async () => setLibraries(await window.romorg.libraries.list())}
            />

            <section className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runScan()}
                disabled={busy !== null}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy === 'scanning' ? t.scanning : t.scan}
              </button>
              {busy !== null && (
                <button
                  type="button"
                  onClick={() =>
                    void (busy === 'scanning'
                      ? window.romorg.scan.cancel(active.id)
                      : window.romorg.plan.cancel(active.id))
                  }
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
                >
                  {t.cancel}
                </button>
              )}

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={useLibretro}
                  onChange={(event) => setUseLibretro(event.target.checked)}
                />
                {t.useLibretro}
              </label>

              <button
                type="button"
                onClick={() =>
                  void window.romorg.dats.chooseLocal().then((paths) => {
                    if (paths.length > 0) setLocalDatPaths((current) => [...current, ...paths])
                  })
                }
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm"
              >
                {t.chooseLocalDats}
              </button>
              {localDatPaths.length > 0 && (
                <span className="text-xs text-neutral-500">
                  {t.localDatsCount(localDatPaths.length)}
                </span>
              )}
            </section>

            {(() => {
              const current =
                busy === 'scanning' ? progress : busy === 'applying' ? applyProgress : null
              if (current === null) return null

              const percent = (current.done / Math.max(current.total, 1)) * 100
              return (
                <div>
                  <div className="h-1 w-full overflow-hidden rounded bg-neutral-800">
                    <div
                      className="h-full bg-emerald-500 transition-[width]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1 truncate text-xs text-neutral-500">
                    {current.done}/{current.total} · {current.currentFile}
                  </p>
                </div>
              )
            })()}

            {error !== null && (
              <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            {notice !== null && (
              <p className="rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
                {notice}
              </p>
            )}

            <TemplateEditor
              value={template}
              systemDefault={activeSystem?.defaultTemplate ?? '{title}.{ext}'}
              onCommit={(template) => void updateTemplate(template)}
            />

            {scan !== null && <ScanTable rows={scan.rows} />}

            {plan !== null && (
              <PlanPanel
                plan={plan}
                busy={busy === 'applying'}
                includeFilenameMatches={includeFilenameMatches}
                allowAmbiguous={allowAmbiguous}
                onToggleFilenameMatches={setIncludeFilenameMatches}
                onToggleAmbiguous={setAllowAmbiguous}
                quarantineDirectory={quarantineDirectory}
                onQuarantineChange={(next) => void updateQuarantine(next)}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onApply={() => void applyPlan()}
              />
            )}

            <HistoryPanel journals={journals} onUndo={(path) => void undo(path)} />
          </div>
        )}
      </main>
    </div>
  )
}
