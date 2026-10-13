import { describe, expect, it, vi } from 'vitest'
import { AbiFunction, Address, Bytes, Hex, Provider } from 'ox'

import { Constants, Config, Context, Payload, Signature } from '../../primitives/src/index.js'
import { State, Wallet } from '../src/index.js'

const SIGNER = '0x1234567890123456789012345678901234567890' as Address.Address
const PASSKEYS_MODULE = '0x0000000000005204f3711851ead52cc9c241499a' as Address.Address
const PASSKEY_SIGNATURE_DATA = '0xdeadbeefdeadbeefdeadbeef' as Hex.Hex
const TARGET = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address.Address
const FEE_OPTIONS_STUB_SIGNATURE =
  '0x040001711fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0' as Hex.Hex

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

    const expectedData = AbiFunction.encodeData(Constants.EXECUTE, [
      Bytes.toHex(Payload.encode(payload)),
      FEE_OPTIONS_STUB_SIGNATURE,
    ])

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
      FEE_OPTIONS_STUB_SIGNATURE,
    ])

    expect(Address.isEqual(transaction.to, Constants.DefaultGuestAddress)).toBe(true)
    expect(decoded.calls).toHaveLength(2)
    expect(Address.isEqual(decoded.calls[0]!.to, deploy.to)).toBe(true)
    expect(decoded.calls[0]!.data).toBe(deploy.data)
    expect(Address.isEqual(decoded.calls[1]!.to, wallet.address)).toBe(true)
    expect(decoded.calls[1]!.data).toBe(expectedExecuteData)
  })

  it('stubs signatures in pending config updates so sapient signers cannot revert the simulation', async () => {
    const stateProvider = new State.Local.Provider()
    const wallet = await Wallet.fromConfiguration(configuration, { stateProvider, context: Context.Dev2 })
    const imageHash = Hex.from(Config.hashConfiguration(configuration))

    const updatedConfiguration: Config.Config = { ...configuration, checkpoint: 1n }
    const updatedImageHash = Hex.from(Config.hashConfiguration(updatedConfiguration))
    await stateProvider.saveConfiguration(updatedConfiguration)

    // Pending update signed by a passkey (sapient) signer from the deployed configuration
    const pendingSignature: Signature.RawSignature = {
      noChainId: true,
      configuration: {
        threshold: 1n,
        checkpoint: 0n,
        topology: [
          {
            type: 'unrecovered-signer',
            weight: 1n,
            signature: { type: 'sapient_compact', address: PASSKEYS_MODULE, data: PASSKEY_SIGNATURE_DATA },
          },
          { type: 'signer', address: SIGNER, weight: 1n },
        ],
      },
    }
    vi.spyOn(stateProvider, 'getConfigurationUpdates').mockResolvedValue([
      { imageHash: updatedImageHash, signature: pendingSignature },
    ])

    const transaction = await wallet.buildFeeOptionsTransaction(providerFor({ deployed: true, imageHash }), payload)
    const [, signature] = AbiFunction.decodeData(Constants.EXECUTE, transaction.data)

    const expectedSignature = Bytes.toHex(
      Signature.encodeSignature({
        noChainId: false,
        configuration: {
          ...updatedConfiguration,
          topology: {
            type: 'unrecovered-signer',
            weight: 1n,
            signature: {
              type: 'eth_sign',
              r: 0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
              s: 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n,
              yParity: 0,
            },
          },
        },
        suffix: [
          {
            ...pendingSignature,
            configuration: {
              ...pendingSignature.configuration,
              topology: [
                {
                  type: 'unrecovered-signer',
                  weight: 1n,
                  signature: {
                    type: 'eth_sign',
                    r: 0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
                    s: 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n,
                    yParity: 0,
                  },
                },
                { type: 'signer', address: SIGNER, weight: 1n },
              ],
            },
          },
        ],
      }),
    )

    expect(signature).toBe(expectedSignature)
    expect(signature).not.toContain(PASSKEY_SIGNATURE_DATA.slice(2))
  })

  it('stubs recovered sapient signer leaves returned by state providers for pending updates', async () => {
    const stateProvider = new State.Local.Provider()
    const wallet = await Wallet.fromConfiguration(configuration, { stateProvider, context: Context.Dev2 })
    const imageHash = Hex.from(Config.hashConfiguration(configuration))

    const updatedConfiguration: Config.Config = { ...configuration, checkpoint: 1n }
    const updatedImageHash = Hex.from(Config.hashConfiguration(updatedConfiguration))
    await stateProvider.saveConfiguration(updatedConfiguration)

    // State providers return recovered leaves (e.g. Sequence provider recovers the config)
    const pendingSignature = {
      noChainId: true,
      configuration: {
        threshold: 1n,
        checkpoint: 0n,
        topology: [
          {
            type: 'sapient-signer',
            address: PASSKEYS_MODULE,
            imageHash: Hex.padLeft('0x01', 32),
            weight: 1n,
            signed: true,
            signature: { type: 'sapient_compact', address: PASSKEYS_MODULE, data: PASSKEY_SIGNATURE_DATA },
          },
          { type: 'signer', address: SIGNER, weight: 1n },
        ],
      },
    } as Signature.RawSignature
    vi.spyOn(stateProvider, 'getConfigurationUpdates').mockResolvedValue([
      { imageHash: updatedImageHash, signature: pendingSignature },
    ])

    const transaction = await wallet.buildFeeOptionsTransaction(providerFor({ deployed: true, imageHash }), payload)
    const [, signature] = AbiFunction.decodeData(Constants.EXECUTE, transaction.data)

    expect(signature).not.toContain(PASSKEY_SIGNATURE_DATA.slice(2))
  })
})
