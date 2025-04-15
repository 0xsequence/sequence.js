import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // TODO: This shouldn't be needed, fix sdk build
    include: [
      '@0xsequence/wallet-core',
      '@0xsequence/sequence-primitives',
      '@0xsequence/sequence-wdk',
      '@0xsequence/api',
    ],
  },
})
