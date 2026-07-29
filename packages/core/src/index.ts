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
  renderTemplate,
  sanitizeFileName,
  TemplateError,
  type TemplateTokens,
} from './naming/template.ts'

export {
  identifyFile,
  type Identification,
  type IdentificationMethod,
} from './identify/identify.ts'
export { scanDirectory, type ScanOptions, type ScanSummary } from './identify/scan.ts'
