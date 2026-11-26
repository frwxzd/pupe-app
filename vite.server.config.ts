import { defineConfig } from 'vite'

// Compila la API (server/) a JavaScript para producción: dist-server/index.js y cli.js.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: true,
    outDir: 'dist-server',
    target: 'node20',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: 'server/index.ts', cli: 'server/cli.ts' },
      output: { format: 'esm', entryFileNames: '[name].js' },
    },
  },
})
