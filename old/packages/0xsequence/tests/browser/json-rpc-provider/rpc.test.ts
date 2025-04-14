import { test, assert } from '../../utils/assert'

import { configureLogger } from '@0xsequence/utils'
import { JsonRpcProvider } from '@0xsequence/network'

configureLogger({ logLevel: 'DEBUG', silence: false })

export const tests = async () => {
  const provider = new JsonRpcProvider('http://localhost:8545', { chainId: 31337 }, { cacheTimeout: -1 })

  await test('sending a json-rpc request', async () => {
    {
      const network = await provider.getNetwork()
      console.log('network?', network)
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.equal(BigInt(chainId), 31337n)
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.equal(BigInt(chainId), 31337n)
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.equal(BigInt(chainId), 31337n)
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.equal(BigInt(chainId), 31337n)
    }
    {
      const netVersion = await provider.send('net_version', [])
      assert.equal(netVersion, '31337')
    }
  })
}
