import { describe, expect, it, vi } from 'vitest'
import { AbiFunction, Address, Bytes, Hex, Provider } from 'ox'

import { Constants, Config, Context, Payload } from '../../primitives/src/index.js'
import { State, Wallet } from '../src/index.js'

const SIGNER = '0x1234567890123456789012345678901234567890' as Address.Address
const TARGET = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address.Address

const configuration: Config.Config = {
  threshold: 1n,
  checkpoint: 0n,
  topology: { type: 'signer', address: SIGNER, weight: 1n },
}

const call: Payload.Call = {
  to: TARGET,
  value: 0n,
  data: '0x',
  gasLimit: 0n,
  delegateCall: false,
  onlyFallback: false,
  behaviorOnError: 'revert',
}

const payload: Payload.Calls = {
  type: 'call',
  space: 0n,
  nonce: 0n,
  calls: [call],
}

function providerFor(options: { deployed: boolean; imageHash: Hex.Hex }): Provider.Provider {
  return {
    request: vi.fn(async (request: { method: string; params?: unknown[] }) => {
      switch (request.method) {
        case 'eth_chainId':
          return '0x1'

        case 'eth_getCode':
          return options.deployed ? '0x1234' : '0x'

        case 'eth_call': {
          const rpcCall = request.params?.[0] as { data?: Hex.Hex } | undefined

          if (rpcCall?.data === AbiFunction.encodeData(Constants.GET_IMPLEMENTATION)) {
            return options.deployed ? Hex.padLeft(Context.Dev2.stage2, 32) : '0x'
          }

          if (rpcCall?.data === AbiFunction.encodeData(Constants.IMAGE_HASH)) {
            return options.imageHash
          }

          return '0x'
        }

        default:
          throw new Error(`Unexpected RPC method: ${request.method}`)
      }
    }),
  } as unknown as Provider.Provider
}

async function createWallet() {
  const stateProvider = new State.Local.Provider()
  const wallet = await Wallet.fromConfiguration(configuration, { stateProvider, context: Context.Dev2 })
  const imageHash = Hex.from(Config.hashConfiguration(configuration))

  return { wallet, imageHash }
}

describe('Wallet.buildFeeOptionsTransaction', () => {
  it('targets the wallet execute method when the wallet is deployed', async () => {
    const { wallet, imageHash } = await createWallet()
    const transaction = await wallet.buildFeeOptionsTransaction(providerFor({ deployed: true, imageHash }), payload)

    const expectedData = AbiFunction.encodeData(Constants.EXECUTE, [Bytes.toHex(Payload.encode(payload)), '0x0001'])

    expect(Address.isEqual(transaction.to, wallet.address)).toBe(true)
    expect(transaction.data).toBe(expectedData)
  })

  it('targets the guest module and prefixes deployment when the wallet is undeployed', async () => {
    const { wallet, imageHash } = await createWallet()
    const deploy = await wallet.buildDeployTransaction()
    const transaction = await wallet.buildFeeOptionsTransaction(providerFor({ deployed: false, imageHash }), payload)
    const decoded = Payload.decode(Bytes.fromHex(transaction.data))

    const expectedExecuteData = AbiFunction.encodeData(Constants.EXECUTE, [
      Bytes.toHex(Payload.encode(payload)),
      '0x0001',
    ])

    expect(Address.isEqual(transaction.to, Constants.DefaultGuestAddress)).toBe(true)
    expect(decoded.calls).toHaveLength(2)
    expect(Address.isEqual(decoded.calls[0]!.to, deploy.to)).toBe(true)
    expect(decoded.calls[0]!.data).toBe(deploy.data)
    expect(Address.isEqual(decoded.calls[1]!.to, wallet.address)).toBe(true)
    expect(decoded.calls[1]!.data).toBe(expectedExecuteData)
  })
})
