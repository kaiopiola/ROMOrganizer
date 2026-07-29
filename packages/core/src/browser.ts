/**
 * Subconjunto do core seguro para o renderer.
 *
 * O entrypoint principal toca disco, SQLite e zip — arrastar isso para a interface quebraria
 * o bundle e, pior, colocaria acesso a arquivo do lado errado da ponte. Aqui só entra código
 * puro: manipulação de string e tipos.
 *
 * A regra para adicionar algo neste arquivo: se o módulo importa `node:` alguma coisa, ele
 * não pertence aqui.
 */
export {
  buildFileName,
  buildRelativePath,
  renderTemplate,
  sanitizeFileName,
  TEMPLATE_TOKENS,
  TemplateError,
  type TemplateToken,
  type TemplateTokens,
} from './naming/template.ts'

export { parseRomName, type ParsedRomName } from './naming/parse-name.ts'

export type { ByteOrderVariant, HeaderRule, SystemRulePack } from './systems/types.ts'
export type { IdentificationMethod } from './identify/identify.ts'
export type { SkipReason } from './plan/plan.ts'
export type { MatchedBy } from './dat/index-db.ts'
