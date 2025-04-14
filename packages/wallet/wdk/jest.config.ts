import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  moduleNameMapper: {
    '^@0xsequence/sequence-wdk$': '<rootDir>/src',
    '^@0xsequence/sequence-core$': '<rootDir>/../core/src',
    '^@0xsequence/sequence-primitives$': '<rootDir>/../primitives/src',
  },
}

export default config
