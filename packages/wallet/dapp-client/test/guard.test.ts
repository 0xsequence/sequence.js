import { describe, expect, it } from 'vitest'
import { Config } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'

import { getModuleGuardCandidates } from '../src/utils/guard.js'

const sessionsModule: Address.Address = '0x0000000000000000000000000000000000005e55'
const otherModule: Address.Address = '0x000000000000000000000000000000000000beef'
const oldGuard: Address.Address = '0x00000000000000000000000000000000000001d0'
const newGuard: Address.Address = '0x000000000000000000000000000000000000ae01'
const recoveryMultisig: Address.Address = '0x007a47e6BF40C1e0ed5c01aE42fDC75879140bc4'

function walletConfig(sessionsGuard: Address.Address): Config.Config {
  const guardLeaf: Config.NestedLeaf = {
    type: 'nested',
    weight: 1n,
    threshold: 1n,
    tree: [
      { type: 'signer', address: sessionsGuard, weight: 1n },
      { type: 'signer', address: recoveryMultisig, weight: 1n },
    ],
  }

  return {
    threshold: 2n,
    checkpoint: 3n,
    topology: [
      [
        [
          { type: 'signer', address: '0x0000000000000000000000000000000000000a11', weight: 1n },
          { type: 'signer', address: '0x0000000000000000000000000000000000000de1', weight: 1n },
        ],
        { type: 'signer', address: '0x0000000000000000000000000000000000000ff1', weight: 1n },
      ],
      [
        {
          type: 'nested',
          weight: 255n,
          threshold: 2n,
          tree: [
            { type: 'sapient-signer', address: sessionsModule, weight: 1n, imageHash: `0x${'11'.repeat(32)}` },
            guardLeaf,
          ],
        },
        { type: 'sapient-signer', address: otherModule, weight: 255n, imageHash: `0x${'22'.repeat(32)}` },
      ],
    ],
  }
}

describe('getModuleGuardCandidates', () => {
  it('keeps the cached guard while the configuration still references it', () => {
    expect(getModuleGuardCandidates(walletConfig(oldGuard), sessionsModule, oldGuard)).toEqual([oldGuard])
  })

  it('uses the guard from the configuration once the wallet moved to a new guard', () => {
    const candidates = getModuleGuardCandidates(walletConfig(newGuard), sessionsModule, oldGuard)
    expect(candidates[0]).toBe(newGuard)
    expect(candidates).not.toContain(oldGuard)
  })

  it('falls back to the cached guard when the module has no guard leaf', () => {
    expect(getModuleGuardCandidates(walletConfig(newGuard), otherModule, oldGuard)).toEqual([oldGuard])
    expect(getModuleGuardCandidates(walletConfig(newGuard), otherModule)).toEqual([])
  })
})
