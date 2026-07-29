import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'desktop-main',
    environment: 'node',
    // Só o que roda no processo main e não depende do Electron: persistência e cache.
    // A camada de IPC e a interface precisam do app de verdade.
    include: ['src/main/**/*.test.ts'],
  },
})
