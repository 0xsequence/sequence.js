import { Address, Bytes, Hex } from 'ox'
import { describe, expect, it, vi } from 'vitest'

import { Payload } from '../../../primitives/src/index.js'
import { State } from '../../src/index.js'

const wallet: Address.Address = '0x1111111111111111111111111111111111111111'
const payload: Payload.Calls = {
  type: 'call',
  space: 0x1234n,
  nonce: 0n,
  calls: [
    {
      to: wallet,
      value: 0n,
      data: '0x29561426' as Hex.Hex,
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'revert',
    },
  ],
}
const signature: Hex.Hex = '0x0203'

describe('Guard settlements in state providers', () => {
  it('sends the settlement to the key machine', async () => {
    const fetch = vi.fn(async (_url: string, _init: { body: string }) => new Response('{}', { status: 200 }))
    const provider = new State.Sequence.Provider('https://keymachine.test', fetch as any)

    await provider.saveGuardSettlement(wallet, payload, signature)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://keymachine.test/rpc/Sessions/SaveGuardSettlement')
    const body = JSON.parse(init.body)
    expect(body.wallet).toBe(wallet)
    expect(body.signature).toBe(signature)
    expect(Payload.decode(Bytes.fromHex(body.payload))).toEqual(payload)
  })

  it('is only exposed by Cached when its source supports it', async () => {
    const local = new State.Local.Provider()
    expect(new State.Cached({ source: local, cache: new State.Local.Provider() }).saveGuardSettlement).toBeUndefined()

    const saveGuardSettlement = vi.fn(async () => {})
    const source = Object.assign(new State.Local.Provider(), { saveGuardSettlement })
    const cached = new State.Cached({ source, cache: new State.Local.Provider() })
    await cached.saveGuardSettlement!(wallet, payload, signature)
    expect(saveGuardSettlement).toHaveBeenCalledWith(wallet, payload, signature)
  })
})
