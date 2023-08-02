import { ethers } from 'ethers'
import { test, assert } from '../../utils/assert'

import { configureLogger } from '@0xsequence/utils'
import { JsonRpcProvider, loggingProviderMiddleware } from '@0xsequence/network'

configureLogger({ logLevel: 'DEBUG', silence: false })

export const tests = async () => {
  // const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545', 31337)
  const provider = new JsonRpcProvider('http://localhost:8545', { chainId: 31337 })

  await test('sending a json-rpc request', async () => {
    {
      const network = await provider.getNetwork()
      console.log('network?', network)
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.true(ethers.BigNumber.from(chainId).toString() === '31337')
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.true(ethers.BigNumber.from(chainId).toString() === '31337')
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.true(ethers.BigNumber.from(chainId).toString() === '31337')
    }
    {
      const chainId = await provider.send('eth_chainId', [])
      assert.true(ethers.BigNumber.from(chainId).toString() === '31337')
    }
    {
      const netVersion = await provider.send('net_version', [])
      assert.true(netVersion === '31337')
    }
  })
}
