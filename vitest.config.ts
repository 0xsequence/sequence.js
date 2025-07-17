import { BrowserNavigationCrossOriginPolicyEnum } from 'happy-dom'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    minWorkers: 1,
    maxWorkers: 1,
    environmentOptions: {
      happyDOM: {
        settings: {
          fetch: {
            disableSameOriginPolicy: true,
          },
        },
      },
    },
  },
})
