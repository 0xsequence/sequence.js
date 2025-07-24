import { Address, Constants, Config, Erc6492, Payload } from '@0xsequence/wallet-primitives'
import { Hash, Hex, Provider, RpcTransport, Secp256k1, TypedData } from 'ox'
import { describe, expect, it } from 'vitest'

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

      it('should sign a typed data message', async () => {
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

        const message = {
          domain: {
            name: 'MyApp',
            version: '1',
            chainId: Number(chainId),
            verifyingContract: Constants.ZeroAddress,
          },
          types: {
            Mail: [
              { name: 'from', type: 'address' },
              { name: 'to', type: 'address' },
              { name: 'contents', type: 'string' },
            ],
          },
          primaryType: 'Mail' as const,
          message: {
            from: Constants.ZeroAddress,
            to: Constants.ZeroAddress,
            contents: 'Hello, Bob!',
          },
        }

        const data = TypedData.encode(message)
        const messageHash = Hash.keccak256(data)

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

  it('Should reject unsafe wallet creation', async () => {
    // Threshold 0
    const walletPromise1 = Wallet.fromConfiguration(
      {
        threshold: 0n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
      },
    )

    await expect(walletPromise1).rejects.toThrow('threshold-0')

    // Weight too high
    const walletPromise2 = Wallet.fromConfiguration(
      {
        threshold: 1n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 256n },
      },
      {
        stateProvider,
      },
    )

    await expect(walletPromise2).rejects.toThrow('invalid-values')

    // Threshold too high
    const walletPromise3 = Wallet.fromConfiguration(
      {
        threshold: 65536n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
      },
    )

    await expect(walletPromise3).rejects.toThrow('unsafe-invalid-values')

    // Checkpoint too high
    const walletPromise4 = Wallet.fromConfiguration(
      {
        threshold: 1n,
        checkpoint: 72057594037927936n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
      },
    )

    await expect(walletPromise4).rejects.toThrow('unsafe-invalid-values')

    // Unreachable threshold
    const walletPromise5 = Wallet.fromConfiguration(
      {
        threshold: 2n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
      },
    )

    await expect(walletPromise5).rejects.toThrow('unsafe-threshold')

    // Topology too deep (more than 32 levels)
    let topology: Config.Topology = {
      type: 'signer',
      address: Constants.ZeroAddress,
      weight: 1n,
    }

    for (let i = 0; i < 33; i++) {
      topology = [
        topology,
        {
          type: 'signer',
          address: Constants.ZeroAddress,
          weight: 1n,
        },
      ]
    }

    const walletPromise6 = Wallet.fromConfiguration(
      {
        threshold: 1n,
        checkpoint: 0n,
        topology,
      },
      {
        stateProvider,
      },
    )

    await expect(walletPromise6).rejects.toThrow('unsafe-depth')
  })

  it('Should reject unsafe wallet update', async () => {
    const wallet = await Wallet.fromConfiguration(
      {
        threshold: 1n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
      },
    )

    // Threshold 0
    const walletUpdatePromise1 = wallet.prepareUpdate({
      threshold: 0n,
      checkpoint: 0n,
      topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
    })

    await expect(walletUpdatePromise1).rejects.toThrow('unsafe-threshold-0')

    // Weight too high
    const walletUpdatePromise2 = wallet.prepareUpdate({
      threshold: 1n,
      checkpoint: 0n,
      topology: { type: 'signer', address: Constants.ZeroAddress, weight: 256n },
    })

    await expect(walletUpdatePromise2).rejects.toThrow('unsafe-invalid-values')

    // Threshold too high
    const walletUpdatePromise3 = wallet.prepareUpdate({
      threshold: 65536n,
      checkpoint: 0n,
      topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
    })

    await expect(walletUpdatePromise3).rejects.toThrow('unsafe-invalid-values')

    // Checkpoint too high
    const walletUpdatePromise4 = wallet.prepareUpdate({
      threshold: 1n,
      checkpoint: 72057594037927936n,
      topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
    })

    await expect(walletUpdatePromise4).rejects.toThrow('unsafe-invalid-values')

    // Unreachable threshold
    const walletPromise5 = Wallet.fromConfiguration(
      {
        threshold: 2n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
      },
    )

    await expect(walletPromise5).rejects.toThrow('unsafe-threshold')

    // Topology too deep (more than 32 levels)
    let topology: Config.Topology = {
      type: 'signer',
      address: Constants.ZeroAddress,
      weight: 1n,
    }

    for (let i = 0; i < 33; i++) {
      topology = [
        topology,
        {
          type: 'signer',
          address: Constants.ZeroAddress,
          weight: 1n,
        },
      ]
    }

    const walletUpdatePromise6 = wallet.prepareUpdate({
      threshold: 1n,
      checkpoint: 0n,
      topology,
    })

    await expect(walletUpdatePromise6).rejects.toThrow('unsafe-depth')
  })

  it('Should accept unsafe wallet creation in unsafe mode', async () => {
    const wallet = await Wallet.fromConfiguration(
      {
        threshold: 0n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
        unsafe: true,
      },
    )

    expect(wallet).toBeDefined()
  })

  it('Should accept unsafe wallet update in unsafe mode', async () => {
    const wallet = await Wallet.fromConfiguration(
      {
        threshold: 1n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        stateProvider,
      },
    )

    expect(wallet).toBeDefined()

    const walletUpdate = await wallet.prepareUpdate(
      {
        threshold: 0n,
        checkpoint: 0n,
        topology: { type: 'signer', address: Constants.ZeroAddress, weight: 1n },
      },
      {
        unsafe: true,
      },
    )

    expect(walletUpdate).toBeDefined()
  })
})
