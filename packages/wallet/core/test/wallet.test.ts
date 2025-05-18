import { AbiFunction, Address, Bytes, Hash, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { describe, expect, it } from 'vitest'

import { IS_VALID_SIGNATURE } from '../../primitives/src/constants.js'
import { Config, Payload } from '../../primitives/src/index.js'
import { Envelope, State, Wallet } from '../src/index.js'
import { LOCAL_RPC_URL } from './constants.js'

describe('Wallet', async () => {
  const stateProvider = new State.Local.Provider()

  const createRandomSigner = () => {
    const privateKey = Secp256k1.randomPrivateKey()
    const address = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey }))
    return { address, privateKey }
  }

  describe('deployed', async () => {
    const getDeployedWallet = async (config: Config.Config, provider: Provider.Provider) => {
      const wallet = await Wallet.fromConfiguration(config, { stateProvider })
      if (!(await wallet.isDeployed(provider))) {
        // Deploy it
        const deployTransaction = await wallet.buildDeployTransaction()
        const deployResult = await provider.request({
          method: 'eth_sendTransaction',
          params: [deployTransaction],
        })
        await provider.request({
          method: 'eth_getTransactionReceipt',
          params: [deployResult],
        })
      }
      const isDeployed = await wallet.isDeployed(provider)
      expect(isDeployed).toBe(true)
      return wallet
    }

    it('should sign a message', async () => {
      const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
      const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

      const signer = createRandomSigner()
      const wallet = await getDeployedWallet(
        {
          threshold: 1n,
          checkpoint: 0n,
          topology: { type: 'signer', address: signer.address, weight: 1n },
        },
        provider,
      )

      const message = Hex.fromString('Hello, world!')
      const messageHash = Hash.keccak256(message)
      console.log('messageHash', messageHash)

      const envelope = await wallet.prepareMessageSignature(message, chainId)
      const payloadHash = Payload.hash(wallet.address, chainId, envelope.payload)
      console.log('payloadHash', Bytes.toHex(payloadHash))

      // Sign it
      const signerSignature = Secp256k1.sign({
        payload: payloadHash,
        privateKey: signer.privateKey,
      })
      const signedEnvelope = Envelope.toSigned(envelope, [
        {
          address: signer.address,
          signature: {
            type: 'hash',
            ...signerSignature,
          },
        },
      ])

      // Encode it
      const signature = await wallet.buildMessageSignature(signedEnvelope, provider)

      // Validate it using IERC1271
      const requestData = AbiFunction.encodeData(IS_VALID_SIGNATURE, [messageHash, Bytes.toHex(signature)])
      const result = await provider.request({
        method: 'eth_call',
        params: [
          {
            to: wallet.address,
            data: requestData,
          },
        ],
      })
      const decodedResult = AbiFunction.decodeResult(IS_VALID_SIGNATURE, result)
      expect(decodedResult).toBe(AbiFunction.getSelector(IS_VALID_SIGNATURE))
    })
  })
})
