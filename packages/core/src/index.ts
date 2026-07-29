export type { ByteOrderVariant, HeaderRule, SystemRulePack } from './systems/types.ts'
export { loadRulePacksFrom, SystemRegistry } from './systems/registry.ts'
export { RulePackError, validateRulePack } from './systems/validate.ts'

export { detectHeader, type HeaderDetection } from './rom/header.ts'
export { applyByteSwap, detectByteOrder, type ByteOrderDetection } from './rom/byte-order.ts'

export { Crc32, crc32 } from './hash/crc32.ts'
export {
  hashBytes,
  hashBytesVariants,
  hashChunks,
  hashChunkVariants,
  hashFile,
  hashFileVariants,
  type HashOptions,
  type RomHashes,
  type RomHashVariants,
} from './hash/rom-hash.ts'

export { DatParseError, parseLogiqxDat, type DatEntry, type ParsedDat } from './dat/logiqx.ts'
export { parseClrMameProDat } from './dat/clrmamepro.ts'
export { detectDatFormat, parseDat, type DatFormat } from './dat/parse-dat.ts'
export {
  fetchLibretroDat,
  fetchLibretroDatsFor,
  libretroDatUrl,
  libretroRefsFor,
  LibretroFetchError,
  type FetchOptions,
  type FetchSystemResult,
  type LibretroCollection,
  type LibretroDatRef,
} from './dat/libretro.ts'
export { isZipPath, listZipEntries, openZipEntry, ZipError, type ZipEntry } from './archive/zip.ts'
export {
  DatIndex,
  type IndexMatch,
  type LookupInput,
  type LookupResult,
  type MatchedBy,
} from './dat/index-db.ts'

export { parseRomName, type ParsedRomName } from './naming/parse-name.ts'
export {
  buildFileName,
  buildRelativePath,
  TEMPLATE_TOKENS,
  type TemplateToken,
  renderTemplate,
  sanitizeFileName,
  TemplateError,
  type TemplateTokens,
} from './naming/template.ts'

export {
  identifyFile,
  identifyPath,
  identifyZip,
  reproposeName,
  type Identification,
  type IdentifyOptions,
  type IdentificationMethod,
} from './identify/identify.ts'
export { scanDirectory, type ScanOptions, type ScanSummary } from './identify/scan.ts'
export { HashCache, type CacheKey } from './identify/hash-cache.ts'

export {
  isCaseOnlyRename,
  planRenames,
  type PlannedOperation,
  type PlanOptions,
  type RenamePlan,
  type SkippedFile,
  type SkipReason,
} from './plan/plan.ts'
export {
  executePlan,
  readJournal,
  undoFromJournal,
  type ExecuteOptions,
  type ExecutionFailure,
  type ExecutionResult,
  type JournalRecord,
  type UndoResult,
} from './plan/execute.ts'
