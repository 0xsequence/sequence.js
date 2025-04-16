import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  setupFiles: ['<rootDir>/test/setup.js'],
  moduleNameMapper: {
    '^@0xsequence/wallet-wdk$': '<rootDir>/src',
    '^@0xsequence/wallet-core$': '<rootDir>/../core/src',
    '^@0xsequence/wallet-primitives$': '<rootDir>/../primitives/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
}

export default config
