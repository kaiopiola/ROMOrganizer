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

  scanTitle: 'Identificação',
  scan: 'Identificar',
  scanning: 'Identificando…',
  cancel: 'Cancelar',
  useLibretro: 'Usar DATs do libretro-database',
  chooseLocalDats: 'Adicionar DAT local…',
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

  historyTitle: 'Histórico',
  historyEmpty: 'Nenhuma alteração aplicada ainda.',
  undo: 'Desfazer',
  undone: (count: number) => `${count} restaurado${count === 1 ? '' : 's'}`,
  journalOperations: (count: number) => `${count} arquivo${count === 1 ? '' : 's'}`,

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

  scanTitle: 'Identification',
  scan: 'Identify',
  scanning: 'Identifying…',
  cancel: 'Cancel',
  useLibretro: 'Use libretro-database DATs',
  chooseLocalDats: 'Add local DAT…',
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

  historyTitle: 'History',
  historyEmpty: 'No changes applied yet.',
  undo: 'Undo',
  undone: (count: number) => `${count} restored`,
  journalOperations: (count: number) => `${count} file${count === 1 ? '' : 's'}`,

  failuresTitle: 'Failures',
  error: 'Error',
  dryRunNotice: 'Nothing changes until you click Apply.',
}

/** Português para quem usa o sistema em português; inglês para todo o resto. */
export const t: Dictionary = navigator.language.toLowerCase().startsWith('pt') ? ptBR : en

export const locale = navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
