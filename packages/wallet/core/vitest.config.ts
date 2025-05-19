import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    poolOptions: {
      singleThread: true,
    },
  },
})
