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
      external: [
        'react',
        'react-dom',
        '@0xsequence/design-system',
        'wagmi',
        'viem',
        '@0xsequence/api',
        '@0xsequence/wallet-core',
        '@0xsequence/wallet-primitives',
        '@0xsequence/wallet-wdk',
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
    outDir: 'dist/widget',
    emptyOutDir: true,
  },
  optimizeDeps: {
    force: true,
    // TODO: This shouldn't be needed, fix sdk build
    include: ['@0xsequence/api', '@0xsequence/wallet-core', '@0xsequence/wallet-primitives', '@0xsequence/wallet-wdk'],
  },
})
