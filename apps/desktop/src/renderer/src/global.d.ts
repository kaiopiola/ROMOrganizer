import type { RomOrgApi } from '../../preload/index.ts'

declare global {
  interface Window {
    romorg: RomOrgApi
  }
}

export {}
