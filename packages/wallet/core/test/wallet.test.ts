import { Address, Hash, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { describe, expect, it } from 'vitest'

import { Config, Erc6492, Payload } from '../../primitives/src/index.js'
import { Envelope, State, Wallet } from '../src/index.js'
import { LOCAL_RPC_URL } from './constants.js'

describe('Wallet', async () => {
  const stateProvider = new State.Local.Provider()

  const createRandomSigner = () => {
    const privateKey = Secp256k1.randomPrivateKey()
    const address = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey }))
    return { address, privateKey }
  }

  const getWallet = async (config: Config.Config, provider: Provider.Provider, deployed: boolean) => {
    const wallet = await Wallet.fromConfiguration(config, { stateProvider })
    if (deployed && !(await wallet.isDeployed(provider))) {
      // Deploy it
      const deployTransaction = await wallet.buildDeployTransaction()
      const deployResult = await provider.request({
        method: 'eth_sendTransaction',
        params: [deployTransaction],
      })
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [deployResult],
      })
    }
    const isDeployed = await wallet.isDeployed(provider)
    expect(isDeployed).toBe(deployed)
    return wallet
  }

  const types = ['deployed', 'not-deployed']

  for (const type of types) {
    describe(type, async () => {
      it('should sign a message', async () => {
        const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
        const chainId = BigInt(await provider.request({ method: 'eth_chainId' }))

        const signer = createRandomSigner()
        const wallet = await getWallet(
          {
            threshold: 1n,
            checkpoint: 0n,
            topology: { type: 'signer', address: signer.address, weight: 1n },
          },
          provider,
          type === 'deployed',
        )

        const message = Hex.fromString('Hello, world!')
        const encodedMessage = Hex.concat(
          Hex.fromString(`${`\x19Ethereum Signed Message:\n${Hex.size(message)}`}`),
          message,
        )
        const messageHash = Hash.keccak256(encodedMessage)

        const envelope = await wallet.prepareMessageSignature(message, chainId)
        const payloadHash = Payload.hash(wallet.address, chainId, envelope.payload)

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

        // Validate off chain with ERC-6492
        const isValid = await Erc6492.isValid(wallet.address, messageHash, signature, provider)
        expect(isValid).toBe(true)
      }, 30000)
    })
  }
})
