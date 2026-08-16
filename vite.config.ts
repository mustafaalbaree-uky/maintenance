import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

// Served from https://<user>.github.io/maintenance/
// A visible build stamp, so "is the phone actually running the new build?" is a question
// with an answer rather than a guess. iOS caches a Home Screen app's page hard.
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

export default defineConfig({
  base: '/maintenance/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
