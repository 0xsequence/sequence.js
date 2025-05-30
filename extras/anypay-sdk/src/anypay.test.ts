import { describe, it, expect, jest } from '@jest/globals'
import { getAPIClient, getRelayer, getIntentCallsPayloads } from './'
import { privateKeyToAccount } from 'viem/accounts'
import 'dotenv/config'

describe('AnyPay', () => {
  it(
    'should should an e2e test',
    async () => {
      const originChainId = 421614

      const apiClient = getAPIClient('http://localhost:4422', 'AQAAAAAAAJbd_5JOcE50AqglZCtvu51YlGI')
      const relayer = getRelayer({ env: 'local' }, originChainId)

      const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`)
      const args = {
        userAddress: account.address,
        originChainId: 42161,
        originTokenAddress: '0x0000000000000000000000000000000000000000',
        originTokenAmount: '245084271856447',
        destinationChainId: 8453,
        destinationToAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        destinationTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        destinationTokenAmount: '300000',
        destinationCallData:
          '0xa9059cbb000000000000000000000000750ef1d7a0b4ab1c97b7a623d7917cceb5ea779c00000000000000000000000000000000000000000000000000000000000493e0',
        destinationCallValue: '0',
      }

      const intent = await getIntentCallsPayloads(apiClient, args)
      console.log(intent)

      expect(intent).toBeDefined()
      console.log('done')
    },
    10 * 60 * 1000,
  )
})
