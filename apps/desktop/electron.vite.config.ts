import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // @romorg/core é código-fonte do monorepo, não dependência instalada: precisa
    // entrar no bundle, senão o app empacotado tenta resolver TypeScript em runtime.
    plugins: [externalizeDepsPlugin({ exclude: ['@romorg/core'] })],
    build: {
      rollupOptions: {
        input: resolve('src/main/index.ts'),
      },
    },
  },
  preload: {
    // @romorg/core é código-fonte do monorepo, não dependência instalada: precisa
    // entrar no bundle, senão o app empacotado tenta resolver TypeScript em runtime.
    plugins: [externalizeDepsPlugin({ exclude: ['@romorg/core'] })],
    build: {
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    build: {
      // `root` aponta para src/renderer, então outDir precisa ser explícito para o
      // bundle não sair da pasta do app.
      outDir: resolve('out/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
      },
    },
  },
})
