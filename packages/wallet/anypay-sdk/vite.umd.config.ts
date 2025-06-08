import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// Main build config for ESM/CJS
const mainConfig = defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
    dts({
      include: ['src/**/*'],
      exclude: ['src/umd.tsx'],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: './src/index.ts',
        'widget/index': './src/widget/widget.tsx',
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'js'}`,
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
        exports: 'named',
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    force: true,
    // TODO: This shouldn't be needed, fix sdk build
    include: ['@0xsequence/api', '@0xsequence/wallet-core', '@0xsequence/wallet-primitives', '@0xsequence/wallet-wdk'],
  },
})

// UMD build config
const umdConfig = defineConfig({
  plugins: [react(), cssInjectedByJsPlugin()],
  define: {
    'process.env': JSON.stringify({}),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/umd.tsx'),
      name: 'AnyPayWidget',
      formats: ['umd'],
      fileName: () => 'anypay.min.js',
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
        compact: true,
        minifyInternalExports: true,
        name: 'AnyPayWidget',
        extend: true,
        globals: {
          window: 'window',
        },
      },
    },
    outDir: 'dist/umd',
    emptyOutDir: true,
    minify: true,
    sourcemap: true,
  },
})

export default process.env.BUILD_MODE === 'umd' ? umdConfig : mainConfig
