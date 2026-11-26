import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { generate } from './scripts/seo-build.mjs'
import process from 'node:process'

const indexable = process.env.CONTEXT === 'production' && process.env.URL === 'https://getcyb.fit'

export default defineConfig({
  define: { 'import.meta.env.VITE_CYB_INDEXABLE': JSON.stringify(indexable) },
  plugins: [react(), { name: 'seo-pages', apply: 'build', writeBundle({dir}) {
    generate(dir, indexable)
  } }],
  build: { rollupOptions: { input: { main: 'index.html', isolation: 'staging-isolation.html' } } },
  server: { allowedHosts: ["terminal.local"] },
})
