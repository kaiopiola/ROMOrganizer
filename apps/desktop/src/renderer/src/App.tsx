import { useCallback, useEffect, useState } from 'react'
import type { SystemRulePack } from '@romorg/core/browser'
import type { Library } from '../../main/libraries.ts'
import type { JournalSummary, PlanDto, ScanSummaryDto } from '../../main/ipc-types.ts'
import { t } from './i18n.ts'
import { useJobQueue, type JobOutcome } from './useJobQueue.ts'
import { LibrarySidebar } from './components/LibrarySidebar.tsx'
import { ScanTable } from './components/ScanTable.tsx'
import { PlanPanel } from './components/PlanPanel.tsx'
import { HistoryPanel } from './components/HistoryPanel.tsx'
import { QueuePanel } from './components/QueuePanel.tsx'
import { TemplateEditor } from './components/TemplateEditor.tsx'
import { LibraryToolbar } from './components/LibraryToolbar.tsx'
import { SystemIcon } from './components/SystemIcon.tsx'

export function App() {
  const [systems, setSystems] = useState<SystemRulePack[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [icons, setIcons] = useState<Record<string, string | null>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  const [scan, setScan] = useState<ScanSummaryDto | null>(null)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [journals, setJournals] = useState<JournalSummary[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)

  const [useLibretro, setUseLibretro] = useState(true)
  const [localDatPaths, setLocalDatPaths] = useState<string[]>([])
  const [includeFilenameMatches, setIncludeFilenameMatches] = useState(false)
  const [allowAmbiguous, setAllowAmbiguous] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const active = libraries.find((library) => library.id === activeId) ?? null
  const activeSystem = systems.find((system) => system.id === active?.systemId) ?? null

  const template = active?.template ?? ''
  const quarantineDirectory = active?.quarantineDirectory ?? ''
  const planOptions = { includeFilenameMatches, allowAmbiguous, template, quarantineDirectory }
  const scanOptions = { useLibretro, localDatPaths }

  const refreshLibraries = useCallback(async () => {
    setLibraries(await window.romorg.libraries.list())
  }, [])

  const refreshJournals = useCallback(async (libraryId: string) => {
    setJournals(await window.romorg.journals.list(libraryId))
  }, [])

  /**
   * Recarrega a tela quando um trabalho da fila termina.
   *
   * Só reage ao que é da biblioteca aberta: a fila pode estar processando outra, e trocar o
   * conteúdo da tela por causa de um trabalho que o usuário não está olhando seria confuso.
   */
  const handleJobFinished = useCallback(
    async (outcome: JobOutcome) => {
      if (outcome.kind === 'apply') {
        await refreshJournals(outcome.libraryId)
        if (outcome.libraryId === activeId) {
          setNotice(
            outcome.cancelled === true
              ? t.appliedPartial(outcome.applied ?? 0)
              : t.applied(outcome.applied ?? 0),
          )
        }
        // Depois de renomear, os nomes em tela não valem mais.
        await window.romorg.scan.start(outcome.libraryId, scanOptions)
      }

      if (outcome.libraryId !== activeId) return

      const result = await window.romorg.plan.build(outcome.libraryId, planOptions)
      setScan({ libraryId: outcome.libraryId, rows: result.rows, failures: [] })
      setPlan(result.plan)
      setSelectedIds(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, refreshJournals, useLibretro, localDatPaths, template, quarantineDirectory],
  )

  const queue = useJobQueue(handleJobFinished)

  useEffect(() => {
    void window.romorg.listSystems().then(async (list) => {
      setSystems(list)
      setIcons(await window.romorg.icons.forSystems(list.map((system) => system.id)))
    })
    void refreshLibraries()
  }, [refreshLibraries])

  // Trocar de biblioteca zera o que era da anterior: mostrar um plano de outra pasta seria a
  // forma mais fácil de o usuário aplicar a coisa errada.
  useEffect(() => {
    setScan(null)
    setPlan(null)
    setNotice(null)
    setSelectedIds(null)
    if (activeId !== null) void refreshJournals(activeId)
    else setJournals([])
  }, [activeId, refreshJournals])

  const hasScan = scan !== null

  // O plano é recalculado no main a cada mudança de opção — a interface nunca decide sozinha
  // o que vai para o disco.
  useEffect(() => {
    if (activeId === null || !hasScan) return
    void window.romorg.plan.build(activeId, planOptions).then((result) => {
      setPlan(result.plan)
      setScan((current) => (current === null ? null : { ...current, rows: result.rows }))
      // Um plano novo pode não conter os ids escolhidos antes; voltar para "todos" é o
      // comportamento seguro — o usuário vê a contagem e decide de novo.
      setSelectedIds(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeFilenameMatches, allowAmbiguous, template, quarantineDirectory, activeId, hasScan])

  async function updateLibrary(changes: Partial<Library>): Promise<void> {
    if (active === null) return
    await window.romorg.libraries.update(active.id, changes)
    await refreshLibraries()
  }

  function enqueue(kind: 'scan' | 'apply'): void {
    if (active === null) return
    setError(null)
    setNotice(null)
    queue.enqueue({
      libraryId: active.id,
      kind,
      scanOptions,
      planOptions,
      selectedIds: selectedIds === null ? null : [...selectedIds],
    })
  }

  async function undo(journalPath: string): Promise<void> {
    if (active === null) return
    setError(null)
    try {
      const result = await window.romorg.journals.undo(journalPath)
      setNotice(t.undone(result.restored))
      if (result.failed.length > 0) {
        setError(result.failed.map((failure) => failure.reason).join('\n'))
      }
      await refreshJournals(active.id)
      await window.romorg.scan.start(active.id, scanOptions)
      const rebuilt = await window.romorg.plan.build(active.id, planOptions)
      setScan({ libraryId: active.id, rows: rebuilt.rows, failures: [] })
      setPlan(rebuilt.plan)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const activeJob = active === null ? undefined : queue.activeFor(active.id)
  const isMac = window.romorg.platform === 'darwin'

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <LibrarySidebar
        systems={systems}
        libraries={libraries}
        icons={icons}
        activeId={activeId}
        jobFor={queue.activeFor}
        onSelect={setActiveId}
        onChanged={refreshLibraries}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header
          className={`flex items-center gap-4 border-b border-neutral-800 px-8 ${
            isMac ? 'pt-9 pb-5' : 'py-5'
          }`}
        >
          {active !== null && (
            <SystemIcon source={icons[active.systemId] ?? null} className="size-10 shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">
              {activeSystem?.name ?? (active === null ? t.appName : active.systemId)}
            </h1>
            <p className="truncate text-sm text-neutral-400" title={active?.directory}>
              {active?.directory ?? t.tagline}
            </p>
          </div>
        </header>

        {active === null ? (
          <div className="flex flex-1 items-center justify-center px-8 text-center">
            <p className="max-w-md text-sm text-neutral-500">{t.librariesEmpty}</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 py-6">
            <LibraryToolbar
              library={active}
              disabled={activeJob !== undefined}
              onChanged={refreshLibraries}
            />

            <section className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => enqueue('scan')}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
              >
                {activeJob?.kind === 'scan' ? t.scanning : t.scan}
              </button>

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

            <QueuePanel
              jobs={queue.jobs}
              libraries={libraries}
              onCancel={queue.cancel}
              onClearFinished={queue.clearFinished}
            />

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
              onCommit={(next) => void updateLibrary({ template: next })}
            />

            {scan !== null && <ScanTable rows={scan.rows} />}

            {plan !== null && (
              <PlanPanel
                plan={plan}
                busy={activeJob?.kind === 'apply'}
                includeFilenameMatches={includeFilenameMatches}
                allowAmbiguous={allowAmbiguous}
                onToggleFilenameMatches={setIncludeFilenameMatches}
                onToggleAmbiguous={setAllowAmbiguous}
                quarantineDirectory={quarantineDirectory}
                onQuarantineChange={(next) => void updateLibrary({ quarantineDirectory: next })}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onApply={() => enqueue('apply')}
              />
            )}

            <HistoryPanel journals={journals} onUndo={(path) => void undo(path)} />
          </div>
        )}
      </main>
    </div>
  )
}
