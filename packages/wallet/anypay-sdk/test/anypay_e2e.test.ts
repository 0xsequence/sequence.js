import { describe, it, expect, vi } from 'vitest'
import {
  getAPIClient,
  getRelayer,
  getIntentCallsPayloads,
  calculateIntentAddress,
  commitIntentConfig,
  sendOriginTransaction,
  getERC20TransferData,
  relayerSendMetaTx,
  getMetaTxnReceipt,
  type GetIntentCallsPayloadsReturn,
} from '../src/index.js'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http } from 'viem'
import { arbitrum, base, optimism } from 'viem/chains'
import 'dotenv/config'

// Mock the hooks
vi.mock('@0xsequence/hooks', () => ({
  useIndexerGatewayClient: vi.fn(),
  useQuery: vi.fn(),
  useMemo: vi.fn(),
}))

// Mock react
vi.mock('react', () => ({
  useMemo: vi.fn((fn) => fn()),
}))

const cachedIntent = null

type SendOptions = {
  originChainId: number
  destinationChainId: number
  recipient: string
  destinationTokenAddress: string
  destinationTokenAmount: string
}

async function prepareSend(options: SendOptions) {
  const { originChainId, destinationChainId, recipient, destinationTokenAddress, destinationTokenAmount } = options
  const chain = originChainId === 42161 ? arbitrum : destinationChainId === 8453 ? base : optimism
  const apiClient = getAPIClient('http://localhost:4422', process.env.SEQUENCE_API_KEY as string)
  const originRelayer = getRelayer({ env: 'local' }, originChainId)
  const destinationRelayer = getRelayer({ env: 'local' }, destinationChainId)

  const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`)
  const mainSigner = account.address

  const args = {
    userAddress: mainSigner,
    originChainId,
    originTokenAddress: '0x0000000000000000000000000000000000000000',
    originTokenAmount: '1000000000000000', // max amount
    destinationChainId,
    destinationToAddress: destinationTokenAddress,
    destinationTokenAddress: destinationTokenAddress,
    destinationTokenAmount: destinationTokenAmount,
    destinationCallData: getERC20TransferData(recipient, BigInt(destinationTokenAmount)),
    destinationCallValue: '0',
  }

  console.log('Creating intent with args:', JSON.stringify(args, null, 2))
  let intent: any = cachedIntent // TODO: Add proper type
  if (!intent) {
    intent = await getIntentCallsPayloads(apiClient, args)
  }
  console.log('Got intent:', JSON.stringify(intent, null, 2))

  const intentAddress = calculateIntentAddress(mainSigner, intent.calls, intent.lifiInfos)
  console.log('Calculated intent address:', intentAddress.toString())

  if (!cachedIntent) {
    await commitIntentConfig(apiClient, mainSigner, intent.calls, intent.preconditions, intent.lifiInfos)
  }

  return {
    intentAddress,
    send: async () => {
      const shouldSend = !cachedIntent
      if (shouldSend) {
        console.log('sending origin transaction')
        const originCallParams = {
          to: intent.preconditions[0].data.address,
          data: '0x',
          value: BigInt(intent.preconditions[0].data.min) + BigInt('5600000000000'),
          chainId: originChainId,
          chain,
        }

        const walletClient = createWalletClient({
          chain,
          transport: http(),
        })

        const publicClient = createPublicClient({
          chain,
          transport: http(),
        })

        const tx = await sendOriginTransaction(account, walletClient, originCallParams as any) // TODO: Add proper type
        console.log('origin tx', tx)
        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
        console.log('receipt', receipt)

        await new Promise((resolve) => setTimeout(resolve, 5000))
      }

      const metaTx = intent.metaTxns[0]
      console.log('metaTx', metaTx)
      const opHash = await relayerSendMetaTx(originRelayer, metaTx, [intent.preconditions[0]])

      console.log('opHash', opHash)

      // eslint-disable-next-line no-constant-condition
      while (true) {
        console.log('polling status', metaTx.id as `0x${string}`, BigInt(metaTx.chainId))
        const receipt = await getMetaTxnReceipt(originRelayer, metaTx.id, Number(metaTx.chainId))
        console.log('status', receipt)
        if (receipt.receipt.status === 'confirmed') {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
      const metaTx2 = intent.metaTxns[1]
      console.log('metaTx2', metaTx2)

      const opHash2 = await relayerSendMetaTx(destinationRelayer, metaTx2, [intent.preconditions[1]])
      console.log('opHash2', opHash2)

      // eslint-disable-next-line no-constant-condition
      while (true) {
        console.log('polling status', metaTx2.id as `0x${string}`, BigInt(metaTx2.chainId))
        const receipt = await getMetaTxnReceipt(destinationRelayer, metaTx2.id, Number(metaTx2.chainId))
        console.log('status', receipt)
        if (receipt.receipt.status === 'confirmed') {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    },
  }
}

describe.skip('AnyPay', () => {
  it(
    'should should an e2e test',
    async () => {
      const recipient = '0xef180EDd4B6303a4CeBaF9b6e3a38CC39f381A99'
      const destinationTokenAddress = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' // USDC
      const destinationTokenAmount = '300003'

      const preparedSend = await prepareSend({
        originChainId: 42161,
        destinationChainId: 8453,
        recipient,
        destinationTokenAddress,
        destinationTokenAmount,
      })

      console.log('preparedSend intentAddress', preparedSend.intentAddress) // TODO: to a second send using this intentAddress as the destination address

      await preparedSend.send()

      console.log('done')
    },
    10 * 60 * 1000,
  )
})
