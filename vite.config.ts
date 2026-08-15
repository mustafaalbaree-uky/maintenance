import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

// Served from https://<user>.github.io/maintenance/
export default defineConfig({
  base: '/maintenance/',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
