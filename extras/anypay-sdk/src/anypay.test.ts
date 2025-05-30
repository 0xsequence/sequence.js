import { describe, it, expect, jest } from '@jest/globals'
import {
  getAPIClient,
  getRelayer,
  getIntentCallsPayloads,
  calculateIntentAddress,
  commitIntentConfig,
  sendOriginTransaction,
  getERC20TransferData,
} from './'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http } from 'viem'
import { arbitrum } from 'viem/chains'
import 'dotenv/config'
import { Hex } from 'viem'

describe('AnyPay', () => {
  it(
    'should should an e2e test',
    async () => {
      const originChainId = 42161
      const destinationChainId = 8453
      const apiClient = getAPIClient('http://localhost:4422', 'AQAAAAAAAJbd_5JOcE50AqglZCtvu51YlGI')
      const originRelayer = getRelayer({ env: 'local' }, originChainId)
      const destinationRelayer = getRelayer({ env: 'local' }, destinationChainId)

      const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`)
      const mainSigner = account.address
      const recipient = '0xef180EDd4B6303a4CeBaF9b6e3a38CC39f381A99'
      const destinationTokenAddress = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
      const destinationTokenAmount = '300000'

      const originTokenAmount = '245084271856447'
      const args = {
        userAddress: mainSigner,
        originChainId: 42161,
        originTokenAddress: '0x0000000000000000000000000000000000000000',
        originTokenAmount: originTokenAmount,
        destinationChainId: 8453,
        destinationToAddress: destinationTokenAddress,
        destinationTokenAddress: destinationTokenAddress,
        destinationTokenAmount: destinationTokenAmount,
        destinationCallData: getERC20TransferData(recipient, BigInt(destinationTokenAmount)),
        destinationCallValue: '0',
      }

      console.log('Creating intent with args:', JSON.stringify(args, null, 2))
      const intent = await getIntentCallsPayloads(apiClient, args)
      console.log('Got intent:', JSON.stringify(intent, null, 2))

      console.log('Calculating intent address with:', {
        mainSigner,
        calls: JSON.stringify(intent.calls, null, 2),
        lifiInfos: JSON.stringify(intent.lifiInfos, null, 2),
      })
      const intentAddress = calculateIntentAddress(mainSigner, intent.calls, intent.lifiInfos)
      console.log('Calculated intent address:', intentAddress.toString())

      console.log('Committing intent config with:', {
        mainSigner,
        calls: JSON.stringify(intent.calls, null, 2),
        preconditions: JSON.stringify(intent.preconditions, null, 2),
        lifiInfos: JSON.stringify(intent.lifiInfos, null, 2),
      })
      const res = await commitIntentConfig(apiClient, mainSigner, intent.calls, intent.preconditions, intent.lifiInfos)
      console.log('Commit response:', JSON.stringify(res, null, 2))

      const shouldSend = false
      if (shouldSend) {
        console.log('sending origin transaction')
        const originCallParams = {
          to: intent.preconditions[0].data.address,
          data: '0x',
          value: originTokenAmount,
          chainId: originChainId,
          chain: arbitrum,
        }

        const walletClient = createWalletClient({
          chain: arbitrum,
          transport: http(),
        })

        const publicClient = createPublicClient({
          chain: arbitrum,
          transport: http(),
        })

        const tx = await sendOriginTransaction(account, walletClient, originCallParams)
        console.log('origin tx', tx)
        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
        console.log('receipt', receipt)
      }

      const metaTx = intent.metaTxns[0]
      console.log('metaTx', metaTx)
      const { opHash } = await originRelayer.sendMetaTxn(
        metaTx.walletAddress as `0x${string}`,
        metaTx.contract as `0x${string}`,
        metaTx.input as Hex,
        BigInt(metaTx.chainId),
        undefined,
        [intent.preconditions[0]],
      )

      console.log('opHash', opHash)

      while (true) {
        console.log('polling status', metaTx.id as `0x${string}`, BigInt(metaTx.chainId))
        const status = await originRelayer.status(metaTx.id as `0x${string}`, BigInt(metaTx.chainId))
        console.log('status', status)
        if (status.status === 'confirmed') {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      const metaTx2 = intent.metaTxns[1]
      console.log('metaTx2', metaTx2)
      const { opHash: opHash2 } = await destinationRelayer.sendMetaTxn(
        metaTx2.walletAddress as `0x${string}`,
        metaTx2.contract as `0x${string}`,
        metaTx2.input as Hex,
        BigInt(metaTx2.chainId),
        undefined,
        [intent.preconditions[1]],
      )

      console.log('opHash2', opHash2)

      while (true) {
        console.log('polling status', metaTx2.id as `0x${string}`, BigInt(metaTx2.chainId))
        const status = await originRelayer.status(metaTx2.id as `0x${string}`, BigInt(metaTx2.chainId))
        console.log('status', status)
        if (status.status === 'confirmed') {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      expect(intent).toBeDefined()
      console.log('done')
    },
    10 * 60 * 1000,
  )
})
