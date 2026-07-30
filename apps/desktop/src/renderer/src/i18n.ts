/**
 * Traduções da interface.
 *
 * Sem biblioteca: o app tem uma tela e algumas dezenas de strings, e um dicionário tipado
 * pega chave faltando em tempo de compilação — que é o que uma lib de i18n traria de útil
 * nesta escala.
 */
const ptBR = {
  appName: 'ROMOrganizer',
  tagline: 'Sua coleção com os nomes certos, na pasta certa.',

  librariesTitle: 'Bibliotecas',
  librariesEmpty: 'Nenhuma pasta vinculada ainda.',
  addLibrary: 'Vincular pasta…',
  chooseSystem: 'Escolha o console',
  searchSystem: 'Buscar console…',
  noSystemFound: 'Nenhum console encontrado.',

  templateTitle: 'Padrão de nomes',
  templateHint: 'Use {token} para os dados do jogo, [ ] para partes opcionais e / para subpastas.',
  templatePresets: 'Exemplos:',
  templatePreviewMissing: 'Sem região nem ano',
  templateMovesFiles: 'Este padrão tem /, então os arquivos serão movidos para subpastas.',
  tokenHint: (token: string) => `Inserir {${token}}`,

  removeLibrary: 'Desvincular',
  revealLibrary: 'Abrir pasta',
  recursive: 'Incluir subpastas',

  restoredStale:
    'Alguns arquivos do último resultado não estão mais na pasta. Identifique de novo para atualizar.',
  queueTitle: 'Fila',
  queueOpen: 'abrir',
  queueClear: 'Limpar concluídos',
  queueEmpty: 'Nada na fila.',
  queueIdle: 'Fila concluída',
  queueActive: 'Em andamento',
  queueFinished: 'Concluídos',
  queueSerialNote: 'Um trabalho por vez: identificar e renomear disputam o mesmo disco.',
  queuePendingCount: (count: number) => `+${count} na fila`,
  queueFinishedWithErrors: (count: number) => `${count} com falha`,
  jobScan: 'Identificar',
  jobApply: 'Aplicar',
  jobPending: 'na fila',
  jobRunning: 'em andamento',
  jobDone: 'concluído',
  jobFailed: 'falhou',
  jobCancelled: 'cancelado',

  scanTitle: 'Identificação',
  scan: 'Identificar',
  scanning: 'Identificando…',
  cancel: 'Cancelar',
  useLibretro: 'Usar DATs do libretro-database',
  chooseLocalDats: 'Adicionar DAT local…',
  clearLocalDats: 'limpar',
  localDatsCount: (count: number) => `${count} DAT local${count === 1 ? '' : 'is'}`,

  colFile: 'Arquivo',
  colMethod: 'Como foi identificado',
  colProposed: 'Nome proposto',

  methodHash: 'hash',
  methodHashHeaderless: 'hash sem header',
  methodFilename: 'nome do arquivo',
  methodUnidentified: 'não identificado',
  methodHashTitle: 'O hash bateu com o DAT. É a identificação confiável.',
  methodHashHeaderlessTitle:
    'O hash bateu depois de descontar o cabeçalho do arquivo. Também é confiável.',
  methodFilenameTitle: 'Palpite a partir do nome do arquivo. Nenhum hash bateu.',
  methodUnidentifiedTitle: 'Nenhum hash bateu e o nome não segue convenção conhecida.',

  fromZip: 'do zip',
  fromZipTitle: 'Identificado pelo CRC que o zip já guarda, sem descomprimir.',
  ambiguous: 'DATs discordam',
  noProposal: '—',

  planTitle: 'Plano',
  planEmpty: 'Nada a renomear.',
  toRename: (count: number) => `${count} a renomear`,
  skippedTitle: 'Fora do plano',
  apply: 'Aplicar',
  applySelected: (count: number) => `Aplicar (${count})`,
  selectedOf: (selected: number, total: number) =>
    `${selected} de ${total} selecionado${selected === 1 ? '' : 's'}`,
  quarantine: 'Mover não identificados para',
  quarantineHint: 'Nada é apagado — os arquivos só saem do meio dos que já estão resolvidos.',
  quarantineTag: 'quarentena',

  applyConfirm: (count: number) =>
    `Renomear ${count} arquivo${count === 1 ? '' : 's'}? Dá para desfazer depois.`,
  applying: 'Aplicando…',
  applied: (count: number) => `${count} renomeado${count === 1 ? '' : 's'}`,
  appliedPartial: (count: number) =>
    `Cancelado. ${count} arquivo${count === 1 ? '' : 's'} já renomeado${count === 1 ? '' : 's'} — dá para desfazer pelo histórico.`,

  includeFilenameMatches: 'Renomear também o identificado só pelo nome',
  includeFilenameMatchesHint:
    'Arriscado: nenhum hash confirmou esses nomes. Reveja um a um antes de aplicar.',
  allowAmbiguous: 'Aplicar mesmo quando os DATs discordam',

  skipAlreadyNamed: 'já está com o nome certo',
  skipNoProposal: 'sem nome a propor',
  skipAmbiguous: 'DATs discordam',
  skipCollision: 'já existe um arquivo com esse nome',
  skipDuplicateTarget: 'dois arquivos apontam para o mesmo nome',

  settingsTitle: 'Configurações',
  settingsHint: 'Preferências do app, versão e atualizações.',
  settingsGeneral: 'Geral',
  settingsUpdates: 'Atualizações',
  settingsChangelog: 'Novidades',
  settingsAbout: 'Sobre',
  settingsLanguage: 'Idioma',
  settingsLanguageAuto: 'Do sistema',
  settingsLanguageHint: 'Trocar o idioma reinicia o app.',
  settingsCheckOnStart: 'Procurar versão nova ao abrir',
  settingsData: 'Dados do app',
  settingsDataHint: 'Onde ficam as bibliotecas, o cache de DATs e os ícones baixados.',
  settingsOpenDataFolder: 'Abrir pasta de dados',
  settingsCheckNow: 'Verificar agora',
  settingsChecking: 'Verificando…',
  settingsUpToDate: 'Você está na versão mais recente.',
  settingsCurrentVersion: (version: string) => `Versão atual: ${version}`,
  settingsMacUnsigned:
    'Esta versão do macOS não é assinada, então o app não instala a atualização sozinho.',
  settingsDevBuild: 'Rodando a partir do código: não há atualização a instalar.',
  settingsNoChangelog: 'Nenhuma nota de versão encontrada.',
  settingsVersion: 'Versão',
  settingsPlatform: 'Plataforma',
  settingsSystemsLoaded: 'Sistemas carregados',
  settingsRepository: 'Repositório do projeto',
  settingsAuthor: 'GitHub do autor',
  settingsLegal:
    'O ROMOrganizer organiza arquivos que já estão no seu disco. Não baixa, não busca e não distribui conteúdo de jogo.',
  settingsCredits:
    'Metadados de DAT do libretro-database (CC BY-SA 4.0). Ícones de console do retroarch-assets (CC BY 4.0).',

  playlistsTitle: 'Playlists',
  playlistsScreenHint: 'Playlists do RetroArch, por plataforma. Regerar substitui a existente.',
  playlistsChecking: 'Verificando…',
  playlistsGenerate: 'Gerar',
  playlistsRegenerate: 'Regerar',
  playlistsGenerating: 'Gerando…',
  playlistsNeedsScan: 'Identifique a pasta primeiro',
  playlistsGeneratedAt: (when: string) => `gerada em ${when}`,
  playlistsItems: (count: number) => `${count} jogo${count === 1 ? '' : 's'}`,
  playlistsGroups: (count: number) => `${count} grupo${count === 1 ? '' : 's'}`,

  auditTitle: 'Auditoria',
  auditHint: 'O que a coleção tem e o que falta, em relação ao DAT.',
  auditRun: 'Auditar',
  auditRunning: 'Auditando…',
  auditEmpty: 'Identifique a pasta e rode a auditoria para ver o que falta.',
  auditSearch: 'Buscar jogo…',
  auditRegions: 'Regiões:',
  auditClearRegions: 'limpar',
  auditIncludeUnreleased: 'Incluir protótipos e betas',
  auditNoResults: 'Nada corresponde ao filtro.',
  auditSummary: (have: number, total: number) => `${have} de ${total} jogos`,
  auditMissing: (count: number) => `Faltando (${count})`,
  auditHave: (count: number) => `Tenho (${count})`,
  auditAll: (count: number) => `Todos (${count})`,
  auditDuplicates: (count: number) => `Duplicados (${count})`,
  auditUnrecognized: (count: number) => `Não reconhecidos (${count})`,

  historyTitle: 'Histórico',
  historyEmpty: 'Nenhuma alteração aplicada ainda.',
  undo: 'Desfazer',
  undone: (count: number) => `${count} restaurado${count === 1 ? '' : 's'}`,
  journalOperations: (count: number) => `${count} arquivo${count === 1 ? '' : 's'}`,

  updateAvailable: (version: string) => `Versão ${version} disponível`,
  updateInstall: 'Atualizar e reiniciar',
  updateInstalling: 'Baixando…',
  updateOpenRelease: 'Abrir download',
  updateManualMac: 'no macOS a atualização é manual',
  updateDismiss: 'depois',

  failuresTitle: 'Falhas',
  error: 'Erro',
  dryRunNotice: 'Nada é alterado até você clicar em Aplicar.',
}

type Dictionary = typeof ptBR

const en: Dictionary = {
  appName: 'ROMOrganizer',
  tagline: 'Your collection, correctly named and in the right folder.',

  librariesTitle: 'Libraries',
  librariesEmpty: 'No folder linked yet.',
  addLibrary: 'Link a folder…',
  chooseSystem: 'Choose the console',
  searchSystem: 'Search console…',
  noSystemFound: 'No console found.',

  templateTitle: 'Naming pattern',
  templateHint: 'Use {token} for game data, [ ] for optional parts, and / for subfolders.',
  templatePresets: 'Examples:',
  templatePreviewMissing: 'Without region or year',
  templateMovesFiles: 'This pattern contains /, so files will be moved into subfolders.',
  tokenHint: (token: string) => `Insert {${token}}`,

  removeLibrary: 'Unlink',
  revealLibrary: 'Open folder',
  recursive: 'Include subfolders',

  restoredStale:
    'Some files from the last result are no longer in the folder. Identify again to refresh.',
  queueTitle: 'Queue',
  queueOpen: 'open',
  queueClear: 'Clear finished',
  queueEmpty: 'Nothing queued.',
  queueIdle: 'Queue finished',
  queueActive: 'In progress',
  queueFinished: 'Finished',
  queueSerialNote: 'One job at a time: identifying and renaming compete for the same disk.',
  queuePendingCount: (count: number) => `+${count} queued`,
  queueFinishedWithErrors: (count: number) => `${count} failed`,
  jobScan: 'Identify',
  jobApply: 'Apply',
  jobPending: 'queued',
  jobRunning: 'running',
  jobDone: 'done',
  jobFailed: 'failed',
  jobCancelled: 'cancelled',

  scanTitle: 'Identification',
  scan: 'Identify',
  scanning: 'Identifying…',
  cancel: 'Cancel',
  useLibretro: 'Use libretro-database DATs',
  chooseLocalDats: 'Add local DAT…',
  clearLocalDats: 'clear',
  localDatsCount: (count: number) => `${count} local DAT${count === 1 ? '' : 's'}`,

  colFile: 'File',
  colMethod: 'How it was identified',
  colProposed: 'Proposed name',

  methodHash: 'hash',
  methodHashHeaderless: 'hash without header',
  methodFilename: 'filename',
  methodUnidentified: 'unidentified',
  methodHashTitle: 'The hash matched the DAT. This is the reliable path.',
  methodHashHeaderlessTitle: 'The hash matched after stripping the file header. Also reliable.',
  methodFilenameTitle: 'A guess from the filename. No hash matched.',
  methodUnidentifiedTitle: 'No hash matched and the name follows no known convention.',

  fromZip: 'from zip',
  fromZipTitle: 'Identified from the CRC the zip already stores — nothing was decompressed.',
  ambiguous: 'DATs disagree',
  noProposal: '—',

  planTitle: 'Plan',
  planEmpty: 'Nothing to rename.',
  toRename: (count: number) => `${count} to rename`,
  skippedTitle: 'Left out',
  apply: 'Apply',
  applySelected: (count: number) => `Apply (${count})`,
  selectedOf: (selected: number, total: number) => `${selected} of ${total} selected`,
  quarantine: 'Move unidentified files to',
  quarantineHint: 'Nothing is deleted — the files just move out of the way of the resolved ones.',
  quarantineTag: 'quarantine',

  applyConfirm: (count: number) =>
    `Rename ${count} file${count === 1 ? '' : 's'}? This can be undone.`,
  applying: 'Applying…',
  applied: (count: number) => `${count} renamed`,
  appliedPartial: (count: number) =>
    `Cancelled. ${count} file${count === 1 ? '' : 's'} already renamed — you can undo from the history.`,

  includeFilenameMatches: 'Also rename what was identified by filename only',
  includeFilenameMatchesHint:
    'Risky: no hash confirmed these names. Review each one before applying.',
  allowAmbiguous: 'Apply even when DATs disagree',

  skipAlreadyNamed: 'already correctly named',
  skipNoProposal: 'no name to propose',
  skipAmbiguous: 'DATs disagree',
  skipCollision: 'a file with that name already exists',
  skipDuplicateTarget: 'two files map to the same name',

  settingsTitle: 'Settings',
  settingsHint: 'App preferences, version and updates.',
  settingsGeneral: 'General',
  settingsUpdates: 'Updates',
  settingsChangelog: 'What is new',
  settingsAbout: 'About',
  settingsLanguage: 'Language',
  settingsLanguageAuto: 'System',
  settingsLanguageHint: 'Changing the language restarts the app.',
  settingsCheckOnStart: 'Check for a new version on launch',
  settingsData: 'App data',
  settingsDataHint: 'Where libraries, the DAT cache and downloaded icons live.',
  settingsOpenDataFolder: 'Open data folder',
  settingsCheckNow: 'Check now',
  settingsChecking: 'Checking…',
  settingsUpToDate: 'You are on the latest version.',
  settingsCurrentVersion: (version: string) => `Current version: ${version}`,
  settingsMacUnsigned:
    'This macOS build is unsigned, so the app cannot install the update by itself.',
  settingsDevBuild: 'Running from source: there is no update to install.',
  settingsNoChangelog: 'No release notes found.',
  settingsVersion: 'Version',
  settingsPlatform: 'Platform',
  settingsSystemsLoaded: 'Systems loaded',
  settingsRepository: 'Project repository',
  settingsAuthor: "Author's GitHub",
  settingsLegal:
    'ROMOrganizer organizes files already on your disk. It does not download, search for or distribute game content.',
  settingsCredits:
    'DAT metadata from libretro-database (CC BY-SA 4.0). Console icons from retroarch-assets (CC BY 4.0).',

  playlistsTitle: 'Playlists',
  playlistsScreenHint: 'RetroArch playlists, per platform. Regenerating replaces the existing one.',
  playlistsChecking: 'Checking…',
  playlistsGenerate: 'Generate',
  playlistsRegenerate: 'Regenerate',
  playlistsGenerating: 'Generating…',
  playlistsNeedsScan: 'Identify the folder first',
  playlistsGeneratedAt: (when: string) => `generated ${when}`,
  playlistsItems: (count: number) => `${count} game${count === 1 ? '' : 's'}`,
  playlistsGroups: (count: number) => `${count} group${count === 1 ? '' : 's'}`,

  auditTitle: 'Audit',
  auditHint: 'What the collection has and what is missing, against the DAT.',
  auditRun: 'Audit',
  auditRunning: 'Auditing…',
  auditEmpty: 'Identify the folder and run the audit to see what is missing.',
  auditSearch: 'Search game…',
  auditRegions: 'Regions:',
  auditClearRegions: 'clear',
  auditIncludeUnreleased: 'Include prototypes and betas',
  auditNoResults: 'Nothing matches the filter.',
  auditSummary: (have: number, total: number) => `${have} of ${total} games`,
  auditMissing: (count: number) => `Missing (${count})`,
  auditHave: (count: number) => `Have (${count})`,
  auditAll: (count: number) => `All (${count})`,
  auditDuplicates: (count: number) => `Duplicates (${count})`,
  auditUnrecognized: (count: number) => `Unrecognized (${count})`,

  historyTitle: 'History',
  historyEmpty: 'No changes applied yet.',
  undo: 'Undo',
  undone: (count: number) => `${count} restored`,
  journalOperations: (count: number) => `${count} file${count === 1 ? '' : 's'}`,

  updateAvailable: (version: string) => `Version ${version} available`,
  updateInstall: 'Update and restart',
  updateInstalling: 'Downloading…',
  updateOpenRelease: 'Open download',
  updateManualMac: 'on macOS the update is manual',
  updateDismiss: 'later',

  failuresTitle: 'Failures',
  error: 'Error',
  dryRunNotice: 'Nothing changes until you click Apply.',
}

/**
 * Idioma da interface.
 *
 * A escolha do usuário vence; `auto` cai no idioma do sistema. O valor chega pronto do
 * processo main, então não existe o momento em que a tela aparece num idioma e troca depois.
 */
function resolveLanguage(): 'pt-BR' | 'en' {
  const chosen = window.romorg.language
  if (chosen === 'pt-BR' || chosen === 'en') return chosen
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

export const locale = resolveLanguage()
export const t: Dictionary = locale === 'pt-BR' ? ptBR : en
