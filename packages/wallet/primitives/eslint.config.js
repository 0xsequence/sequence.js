import { config as baseConfig } from '@repo/eslint-config/base'

/** @type {import("eslint").Linter.Config} */
export default [
  ...baseConfig,
  {
    // files: ['**/*.{test,spec}.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
