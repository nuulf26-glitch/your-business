import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html', isolation: 'staging-isolation.html' } } },
  server: { allowedHosts: ["terminal.local"] },
})
