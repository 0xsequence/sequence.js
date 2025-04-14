import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  moduleNameMapper: {
    '^@0xsequence/wallet-wdk$': '<rootDir>/src',
    '^@0xsequence/wallet-core$': '<rootDir>/../core/src',
    '^@0xsequence/wallet-primitives$': '<rootDir>/../primitives/src',
  },
}

export default config
