import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    force: true,
    // TODO: This shouldn't be needed, fix sdk build
    include: ['@0xsequence/api', '@0xsequence/wallet-core', '@0xsequence/wallet-primitives', '@0xsequence/wallet-wdk'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
