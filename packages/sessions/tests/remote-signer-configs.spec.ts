import { expect } from 'chai'
import { ethers } from 'ethers'

import { trackers } from '../src'

const guardV1 = '0x596aF90CecdBF9A768886E771178fd5561dD27Ab'
const guardV2 = '0x761f5e29944D79d76656323F106CF2efBF5F09e9'
const imageHashV2 = '0x' + '22'.repeat(32)

// Answers externalImageHash() for the v2 guard; the v1 guard has no such function on this chain (reverts)
class MockProvider extends ethers.AbstractProvider {
  calls: string[] = []

  _detectNetwork(): Promise<ethers.Network> {
    return Promise.resolve(new ethers.Network('', 137))
  }

  async _perform<T = any>(req: ethers.PerformActionRequest): Promise<T> {
    if (req.method === 'call') {
      const to = ethers.getAddress((req as any).transaction.to)
      this.calls.push(to)
      if (to === guardV2) {
        return ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [imageHashV2]) as any
      }
      throw new Error('execution reverted')
    }
    throw new Error(`unexpected ${req.method}`)
  }
}

describe('Remote tracker signer configs', () => {
  const provider = new MockProvider()

  const requests: { url: string; body: any }[] = []
  const originalFetch = globalThis.fetch

  before(() => {
    globalThis.fetch = (async (url: string, init: { body: string }) => {
      requests.push({ url, body: JSON.parse(init.body) })
      const body = url.endsWith('/ConfigUpdates') ? { updates: [] } : { migrations: {} }
      return new Response(JSON.stringify(body), { status: 200 })
    }) as any
  })

  after(() => {
    globalThis.fetch = originalFetch
  })

  beforeEach(() => {
    requests.length = 0
    provider.calls.length = 0
  })

  // Created after fetch is stubbed: the client keeps the fetch it was created with
  const newTracker = () =>
    new trackers.remote.RemoteConfigTracker('https://keymachine.test', true, {
      signerWallets: [guardV1, guardV2],
      providerFor: chainId => (chainId === 137 ? provider : undefined)
    })

  it('Should pass the config each signer wallet checks signatures against on the chain', async () => {
    const tracker = newTracker()
    await tracker.loadPresignedConfiguration({ wallet: guardV1, fromImageHash: ethers.ZeroHash, chainId: 137 })
    expect(requests[0].body.signerConfigs).to.deep.equal({ [guardV2]: imageHashV2 })

    await tracker.getMigration(guardV1, ethers.ZeroHash, 1, 137)
    expect(requests[1].url).to.match(/\/Migrations$/)
    expect(requests[1].body.signerConfigs).to.deep.equal({ [guardV2]: imageHashV2 })
  })

  it('Should not pass signer configs without a chain, on chain 0, or without a provider for the chain', async () => {
    const tracker = newTracker()
    await tracker.loadPresignedConfiguration({ wallet: guardV1, fromImageHash: ethers.ZeroHash })
    await tracker.loadPresignedConfiguration({ wallet: guardV1, fromImageHash: ethers.ZeroHash, chainId: 0 })
    await tracker.getMigration(guardV1, ethers.ZeroHash, 1, 1)

    expect(requests.map(({ body }) => body.signerConfigs)).to.deep.equal([undefined, undefined, undefined])
    expect(provider.calls).to.deep.equal([])
  })

  it('Should not pass signer configs when none of the signer wallets answers', async () => {
    const onlyV1 = new trackers.remote.RemoteConfigTracker('https://keymachine.test', true, {
      signerWallets: [guardV1],
      providerFor: () => provider
    })

    await onlyV1.loadPresignedConfiguration({ wallet: guardV1, fromImageHash: ethers.ZeroHash, chainId: 137 })
    expect(requests[0].body.signerConfigs).to.equal(undefined)
  })
})
