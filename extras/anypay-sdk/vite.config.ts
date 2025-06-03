import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(), // inject CSS automatically
  ],
  build: {
    lib: {
      entry: {
        index: './src/index.ts',
        'widget/index': './src/widget/index.tsx',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@0xsequence/design-system', 'wagmi', 'viem'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
    outDir: 'dist/widget',
    emptyOutDir: true,
  },
})
