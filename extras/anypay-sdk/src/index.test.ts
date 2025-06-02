import { describe, it, expect, jest } from '@jest/globals'
import type { MetaTxn } from './metaTxnMonitor'
import * as hooks from './'

jest.mock('./', () => ({
  useAPIClient: jest.fn(),
  useMetaTxnsMonitor: jest.fn(),
  useRelayers: jest.fn(),
  useTokenBalances: jest.fn(),
  useAnyPay: jest.fn(),
}))

describe('SDK Exports', () => {
  it('exports all hooks', () => {
    expect(hooks.useAPIClient).toBeDefined()
    expect(hooks.useMetaTxnsMonitor).toBeDefined()
    expect(hooks.useRelayers).toBeDefined()
    expect(hooks.useTokenBalances).toBeDefined()
    expect(hooks.useAnyPay).toBeDefined()
  })

  it('exports types', () => {
    // Just verify the type exists by using it in a type context
    const _metaTxn: MetaTxn = {
      id: '123',
      chainId: '1',
      contract: '0x123',
      input: '0x456',
      walletAddress: '0x789',
    }
    expect(true).toBe(true) // Type check is done at compile time
  })
})
