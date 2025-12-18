import { describe, expect, it, vi } from 'vitest'

import { Kinds } from '../src/sequence/index.js'
import { newManager } from './constants.js'

describe('Signers.kindOf', () => {
  it('does not probe Sessions/Witness for non-witnessable signers', async () => {
    const getWitnessFor = vi.fn().mockResolvedValue(undefined)
    const getWitnessForSapient = vi.fn().mockResolvedValue(undefined)

    const manager = newManager({
      stateProvider: {
        getWitnessFor,
        getWitnessForSapient,
      } as any,
    })

    const signers = (manager as any).shared.modules.signers
    const extensions = (manager as any).shared.sequence.extensions

    const wallet = '0x1111111111111111111111111111111111111111'
    const imageHash = ('0x' + '00'.repeat(32)) as `0x${string}`

    // Sessions extension signer (sapient leaf) never publishes a witness.
    await signers.kindOf(wallet, extensions.sessions, imageHash)

    // Passkeys module is a known sapient signer kind.
    expect(await signers.kindOf(wallet, extensions.passkeys, imageHash)).toBe(Kinds.LoginPasskey)

    // Sequence dev multisig (default guard topology leaf) never publishes a witness.
    await signers.kindOf(wallet, '0x007a47e6BF40C1e0ed5c01aE42fDC75879140bc4')

    expect(getWitnessFor).not.toHaveBeenCalled()
    expect(getWitnessForSapient).not.toHaveBeenCalled()

    // Unknown signers still rely on a witness probe.
    await signers.kindOf(wallet, '0x2222222222222222222222222222222222222222')
    expect(getWitnessFor).toHaveBeenCalledTimes(1)
  })
})
