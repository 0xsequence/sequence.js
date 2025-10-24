import { LocalRelayer } from '@0xsequence/relayerv2'
import { Orchestrator } from '@0xsequence/signhubv2'
import { v1, commons as v2commons } from '@0xsequence/v2core'
import { Wallet as V1Wallet } from '@0xsequence/v2wallet' // V1 and V2 wallets share the same implementation
import { Envelope, State, Wallet as V3Wallet } from '@0xsequence/wallet-core'
import {
  Payload,
  Config as V3Config,
  Context as V3Context,
  Extensions as V3Extensions,
} from '@0xsequence/wallet-primitives'
import { ethers } from 'ethers'
import { AbiFunction, Address, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { fromRpcStatus } from 'ox/TransactionReceipt'
import { assert, beforeEach, describe, expect, it } from 'vitest'
import { MIGRATION_V1_V3_NONCE_SPACE, MigrationEncoder_v1v3 } from '../../src/migrations/v1/encoder_v1_v3.js'
import { VersionedContext } from '../../src/types.js'
import { convertV2ContextToV3Context, createAnvilSigner, createMultiSigner, MultiSigner } from '../testUtils.js'

describe('MigrationEncoder_v1v3', async () => {
  let anvilSigner: MultiSigner
  let testSigner: MultiSigner

  let providers: {
    v2: ethers.Provider
    v3: Provider.Provider
  }
  let chainId: number

  let migration: MigrationEncoder_v1v3

  let testAddress: Address.Address

  beforeEach(async () => {
    migration = new MigrationEncoder_v1v3()
    const url = 'http://127.0.0.1:8545'
    providers = {
      v2: ethers.getDefaultProvider(url),
      v3: Provider.from(RpcTransport.fromHttp(url)),
    }
    chainId = Number(await providers.v3.request({ method: 'eth_chainId' }))
    testAddress = '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1'
    const testSignerPk = Secp256k1.randomPrivateKey()
    testSigner = createMultiSigner(testSignerPk, providers.v2)
  })

  describe('convertConfig', async () => {
    it('should convert v1 config to v3 config with single signer', async () => {
      const v1Config: v1.config.WalletConfig = {
        version: 1,
        threshold: 1,
        signers: [
          {
            weight: 1,
            address: testSigner.address,
          },
        ],
      }

      const options = {
        loginSigner: {
          address: testSigner.address,
        },
      }

      const v3Config = await migration.convertConfig(v1Config, options)

      expect(v3Config.threshold).toBe(1n)
      expect(v3Config.checkpoint).toBe(0n)
      expect(v3Config.topology).toHaveLength(2)

      // Check first topology (v1 signers) - single signer becomes a single leaf
      const v1Topology = v3Config.topology[0] as V3Config.NestedLeaf
      expect(v1Topology.type).toBe('nested')
      expect(v1Topology.weight).toBe(1n)
      expect(v1Topology.threshold).toBe(1n)
      expect(V3Config.isSignerLeaf(v1Topology.tree)).toBe(true)
      if (V3Config.isSignerLeaf(v1Topology.tree)) {
        expect(v1Topology.tree.type).toBe('signer')
        expect(v1Topology.tree.address).toBe(testSigner.address)
        expect(v1Topology.tree.weight).toBe(1n)
      }

      // Check second topology (v3 extensions)
      const v3Topology = v3Config.topology[1] as V3Config.NestedLeaf
      expect(v3Topology.type).toBe('nested')
      expect(v3Topology.weight).toBe(1n)
      expect(v3Topology.threshold).toBe(2n)
    })

    it('should convert v1 config to v3 config with multiple signers', async () => {
      const testSigner2 = createMultiSigner(Secp256k1.randomPrivateKey(), providers.v2)
      const v1Config: v1.config.WalletConfig = {
        version: 1,
        threshold: 2,
        signers: [
          {
            weight: 1,
            address: testSigner.address,
          },
          {
            weight: 1,
            address: testSigner2.address,
          },
        ],
      }

      const options = {
        loginSigner: {
          address: testSigner.address,
        },
      }

      const v3Config = await migration.convertConfig(v1Config, options)

      expect(v3Config.threshold).toBe(1n)
      expect(v3Config.checkpoint).toBe(0n)

      // Check first topology (v1 signers) - multiple signers become a node array
      const v1Topology = v3Config.topology[0] as V3Config.NestedLeaf
      expect(v1Topology.type).toBe('nested')
      expect(v1Topology.weight).toBe(1n)
      expect(v1Topology.threshold).toBe(2n)
      expect(Array.isArray(v1Topology.tree)).toBe(true)
      expect(v1Topology.tree).toHaveLength(2)
      expect(v1Topology.tree[0].type).toBe('signer')
      expect(v1Topology.tree[0].address).toBe(testSigner.address)
      expect(v1Topology.tree[0].weight).toBe(1n)
      expect(v1Topology.tree[1].type).toBe('signer')
      expect(v1Topology.tree[1].address).toBe(testSigner2.address)
      expect(v1Topology.tree[1].weight).toBe(1n)
    })

    it('should convert v1 config with custom extensions', async () => {
      const v1Config: v1.config.WalletConfig = {
        version: 1,
        threshold: 1,
        signers: [
          {
            weight: 1,
            address: testSigner.address,
          },
        ],
      }

      const customExtensions: V3Extensions.Extensions = {
        passkeys: '0x1234567890123456789012345678901234567890',
        recovery: '0x1111111111111111111111111111111111111111',
        sessions: '0x2222222222222222222222222222222222222222',
      }

      const options = {
        loginSigner: {
          address: testSigner.address,
        },
        extensions: customExtensions,
      }

      const v3Config = await migration.convertConfig(v1Config, options)

      // Check that custom extensions are used in the v3 topology
      const v3Topology = v3Config.topology[1] as V3Config.NestedLeaf
      // The v3 topology should have a tree that's an array with two sub-arrays
      expect(Array.isArray(v3Topology.tree)).toBe(true)
      expect(v3Topology.tree).toHaveLength(2)

      // First sub-array should contain login and guard signers
      const loginArray = v3Topology.tree[0] as V3Config.Node
      expect(Array.isArray(loginArray)).toBe(true)
      expect(loginArray).toHaveLength(2)

      // First element should be login topology
      const loginTopology = loginArray[0]
      expect(V3Config.isSignerLeaf(loginTopology)).toBe(true)
      if (V3Config.isSignerLeaf(loginTopology)) {
        expect(loginTopology.type).toBe('signer')
        expect(loginTopology.address).toBe(testSigner.address)
      }

      // Second sub-array should contain recovery and sessions modules
      const modulesArray = v3Topology.tree[1] as V3Config.Node
      expect(Array.isArray(modulesArray)).toBe(true)
      expect(modulesArray).toHaveLength(2)

      // First module should be recovery
      const recoveryLeaf = modulesArray[0] as V3Config.SapientSignerLeaf
      expect(recoveryLeaf.type).toBe('sapient-signer')
      expect(recoveryLeaf.address).toBe(customExtensions.recovery)

      // Second module should be sessions (nested)
      const sessionsLeaf = modulesArray[1] as V3Config.NestedLeaf
      expect(sessionsLeaf.type).toBe('nested')
      expect(Array.isArray(sessionsLeaf.tree)).toBe(true)
      expect(sessionsLeaf.tree).toHaveLength(2)

      const sessionsSapientLeaf = sessionsLeaf.tree[0] as V3Config.SapientSignerLeaf
      expect(sessionsSapientLeaf.type).toBe('sapient-signer')
      expect(sessionsSapientLeaf.address).toBe(customExtensions.sessions)
    })

    it('should handle login signer with image hash', async () => {
      const v1Config: v1.config.WalletConfig = {
        version: 1,
        threshold: 1,
        signers: [
          {
            weight: 1,
            address: testSigner.address,
          },
        ],
      }

      const imageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const options = {
        loginSigner: {
          address: testSigner.address,
          imageHash: imageHash as Hex.Hex,
        },
      }

      const v3Config = await migration.convertConfig(v1Config, options)

      // Check that login signer is a sapient signer with image hash
      const v3Topology = v3Config.topology[1] as V3Config.NestedLeaf
      expect(Array.isArray(v3Topology.tree)).toBe(true)
      expect(v3Topology.tree).toHaveLength(2)

      // First sub-array should contain login and guard signers
      const loginArray = v3Topology.tree[0] as V3Config.Node
      expect(Array.isArray(loginArray)).toBe(true)
      expect(loginArray).toHaveLength(2)

      // First element should be login topology (sapient signer with image hash)
      const loginTopology = loginArray[0] as V3Config.SapientSignerLeaf
      expect(loginTopology.type).toBe('sapient-signer')
      expect(loginTopology.address).toBe(testSigner.address)
      expect(loginTopology.imageHash).toBe(imageHash)
    })
  })

  describe('prepareMigration', async () => {
    it('should prepare migration transactions correctly', async () => {
      const walletAddress = testAddress
      const contexts: VersionedContext = {
        3: V3Context.Rc3,
      }

      const v3Config: V3Config.Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: [
          {
            type: 'nested',
            weight: 1n,
            threshold: 1n,
            tree: {
              type: 'signer',
              address: testSigner.address,
              weight: 1n,
            },
          },
          {
            type: 'nested',
            weight: 1n,
            threshold: 2n,
            tree: [
              {
                type: 'signer',
                address: testSigner.address,
                weight: 1n,
              },
              {
                type: 'signer',
                address: '0xa2e70CeaB3Eb145F32d110383B75B330fA4e288a',
                weight: 1n,
              },
            ],
          },
        ],
      }

      const randomSpace = BigInt(Math.floor(Math.random() * 10000000000))
      const migrationResult = await migration.prepareMigration(walletAddress, contexts, v3Config, {
        space: BigInt(randomSpace),
      })

      expect(migrationResult.fromVersion).toBe(1)
      expect(migrationResult.toVersion).toBe(3)
      expect(migrationResult.payload.calls).toHaveLength(2)
      expect(migrationResult.payload.nonce).toBe(0n)
      expect(migrationResult.payload.space).toBe(randomSpace)

      // Check first transaction (update implementation)
      const updateImplTx = migrationResult.payload.calls[0]
      expect(updateImplTx.to).toBe(walletAddress)

      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const decodedImplArgs = AbiFunction.decodeData(updateImplementationAbi, updateImplTx.data)
      expect(decodedImplArgs[0].toLowerCase()).toBe(V3Context.Rc3.stage2.toLowerCase())

      // Check second transaction (update image hash)
      const updateImageHashTx = migrationResult.payload.calls[1]
      expect(updateImageHashTx.to).toBe(walletAddress)

      const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')
      const decodedImageHashArgs = AbiFunction.decodeData(updateImageHashAbi, updateImageHashTx.data)
      const expectedImageHash = Hex.fromBytes(V3Config.hashConfiguration(v3Config))
      expect(decodedImageHashArgs[0]).toBe(expectedImageHash)
    })

    it('should use custom context when provided', async () => {
      const walletAddress = testAddress
      const customContext: V3Context.Context = {
        stage1: '0x1111111111111111111111111111111111111111',
        stage2: '0x2222222222222222222222222222222222222222',
        creationCode: '0x3333333333333333333333333333333333333333333333333333333333333333',
        factory: '0x4444444444444444444444444444444444444444',
      }

      const contexts: VersionedContext = {
        3: customContext,
      }

      const v3Config: V3Config.Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: [
          {
            type: 'nested',
            weight: 1n,
            threshold: 1n,
            tree: {
              type: 'signer',
              address: testSigner.address,
              weight: 1n,
            },
          },
          {
            type: 'nested',
            weight: 1n,
            threshold: 2n,
            tree: [
              {
                type: 'signer',
                address: testSigner.address,
                weight: 1n,
              },
              {
                type: 'signer',
                address: '0xa2e70CeaB3Eb145F32d110383B75B330fA4e288a',
                weight: 1n,
              },
            ],
          },
        ],
      }

      const migrationResult = await migration.prepareMigration(walletAddress, contexts, v3Config, {})

      const updateImplTx = migrationResult.payload.calls[0]
      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const decodedImplArgs = AbiFunction.decodeData(updateImplementationAbi, updateImplTx.data)
      expect(decodedImplArgs[0]).toBe(customContext.stage2)
    })

    it('should throw error for invalid context', async () => {
      const walletAddress = testAddress
      const contexts: VersionedContext = {
        3: 'invalid-context' as any,
      }

      const v3Config: V3Config.Config = {
        threshold: 1n,
        checkpoint: 0n,
        topology: {
          type: 'signer',
          address: testSigner.address,
          weight: 1n,
        },
      }

      await expect(migration.prepareMigration(walletAddress, contexts, v3Config, {})).rejects.toThrow('Invalid context')
    })
  })

  describe('decodeTransactions', async () => {
    it('should decode transactions correctly', async () => {
      const walletAddress = testAddress
      const imageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')

      const payload: Payload.Calls = {
        type: 'call',
        space: 0n,
        nonce: 0n,
        calls: [
          {
            to: walletAddress,
            value: 0n,
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
            data: AbiFunction.encodeData(updateImplementationAbi, [V3Context.Rc3.stage2]),
          },
          {
            to: walletAddress,
            value: 0n,
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
            data: AbiFunction.encodeData(updateImageHashAbi, [imageHash]),
          },
        ],
      }

      const decoded = await migration.decodePayload(payload)

      expect(decoded.address).toBe(walletAddress)
      expect(decoded.toImageHash).toBe(imageHash)
    })

    it('should throw error for invalid number of calls', async () => {
      const payload: Payload.Calls = {
        type: 'call',
        space: 0n,
        nonce: 0n,
        calls: [
          {
            to: testAddress,
            value: 0n,
            data: '0x1234567890abcdef',
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
      }

      await expect(migration.decodePayload(payload)).rejects.toThrow('Invalid calls')
    })

    it('should throw error when payload addresses do not match', async () => {
      const differentAddress = '0x9999999999999999999999999999999999999999'
      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')

      const payload: Payload.Calls = {
        type: 'call',
        space: 0n,
        nonce: 0n,
        calls: [
          {
            to: testAddress,
            value: 0n,
            data: AbiFunction.encodeData(updateImplementationAbi, [V3Context.Rc3.stage2]),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
          {
            to: differentAddress,
            value: 0n,
            data: AbiFunction.encodeData(updateImageHashAbi, [
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            ]),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
      }

      await expect(migration.decodePayload(payload)).rejects.toThrow('Invalid to address')
    })

    it('should throw error for invalid payload data', async () => {
      const payload: Payload.Calls = {
        type: 'call',
        space: 0n,
        nonce: 0n,
        calls: [
          {
            to: testAddress,
            value: 0n,
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
            data: '0xinvalid',
          },
          {
            to: testAddress,
            value: 0n,
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
            data: '0xalsoinvalid',
          },
        ],
      }

      await expect(migration.decodePayload(payload)).rejects.toThrow(/^Invalid byte sequence/)
    })
  })

  describe('constants', async () => {
    it('should have correct nonce space', () => {
      expect(MIGRATION_V1_V3_NONCE_SPACE).toBe('0x9e4d5bdafd978baf1290aff23057245a2a62bef5')
    })

    it('should have correct version numbers', () => {
      expect(migration.fromVersion).toBe(1)
      expect(migration.toVersion).toBe(3)
    })
  })

  describe('integration test', async () => {
    it('should use migration ', async () => {
      // Create v1 config
      const v1Config: v1.config.WalletConfig = {
        version: 1,
        threshold: 1,
        signers: [
          {
            weight: 1,
            address: testSigner.address,
          },
          // Include a random signer to avoid image hash collisions
          {
            weight: 1,
            address: Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() })),
          },
        ],
      }
      const v1ImageHash = v1.config.ConfigCoder.imageHashOf(v1Config)
      Hex.assert(v1ImageHash)
      const orchestrator = new Orchestrator([testSigner.v2])
      const anvilSigner = await createAnvilSigner(providers.v2, providers.v3)
      const v1Wallet = await V1Wallet.newWallet<
        v1.config.WalletConfig,
        v1.signature.Signature,
        v1.signature.UnrecoveredSignature
      >({
        context: v1.DeployedWalletContext,
        chainId: Number(chainId),
        coders: {
          config: v1.config.ConfigCoder,
          signature: v1.signature.SignatureCoder,
        },
        orchestrator,
        config: v1Config,
        provider: providers.v2,
        relayer: new LocalRelayer(anvilSigner.v2),
      })
      const walletAddress = Address.from(v1Wallet.address)

      // Convert to v3 config
      const options = {
        loginSigner: {
          address: testSigner.address,
        },
      }
      const v3Config = await migration.convertConfig(v1Config, options)

      // Prepare migration
      const contexts: VersionedContext = {
        3: V3Context.Rc3,
      }
      const unsignedMigration = await migration.prepareMigration(walletAddress, contexts, v3Config, {})

      // Decode transactions
      const decoded = await migration.decodePayload(unsignedMigration.payload)
      expect(decoded.address).toBe(walletAddress)
      expect(decoded.toImageHash).toBe(Hex.fromBytes(V3Config.hashConfiguration(v3Config)))

      // Sign it using v1 wallet
      const v2Nonce = v2commons.transaction.encodeNonce(
        unsignedMigration.payload.space,
        unsignedMigration.payload.nonce,
      )
      const txBundle: v2commons.transaction.TransactionBundle = {
        entrypoint: walletAddress,
        transactions: unsignedMigration.payload.calls.map(
          (call): v2commons.transaction.Transaction => ({
            to: call.to,
            data: call.data,
            gasLimit: call.gasLimit.toString(),
            delegateCall: call.delegateCall,
            revertOnError: call.behaviorOnError === 'revert',
          }),
        ),
        nonce: v2Nonce,
      }
      const signedTxBundle = await v1Wallet.signTransactionBundle(txBundle)
      const decorated = await v1Wallet.decorateTransactions(signedTxBundle)

      // Send it
      const tx = await v1Wallet.sendSignedTransaction(decorated)
      const receipt = await tx.wait()
      expect(receipt?.status).toBe(1)
      // This should now be a v3 wallet on chain

      // Save the wallet information to the state provider
      const stateProvider = new State.Local.Provider()
      await stateProvider.saveDeploy(v1ImageHash, convertV2ContextToV3Context(v1.DeployedWalletContext))
      await stateProvider.saveConfiguration(v3Config)

      // Test the wallet works as a v3 wallet now with a test transaction
      const v3Wallet = new V3Wallet(walletAddress, { stateProvider })
      const call: Payload.Call = {
        to: Address.from('0x0000000000000000000000000000000000000000'),
        data: Hex.fromString('0x'),
        value: 0n,
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      }
      const envelope = await v3Wallet.prepareTransaction(providers.v3, [call], {
        space: BigInt(Math.floor(Math.random() * 1000000000000000000)),
        noConfigUpdate: true,
      })

      const signature = await testSigner.v3.sign(v3Wallet.address, Number(chainId), envelope.payload)
      const signedEnvelope = Envelope.toSigned(envelope, [
        {
          address: testSigner.address,
          signature,
        },
      ])
      const signedTx = await v3Wallet.buildTransaction(providers.v3, signedEnvelope)
      const testTx = await providers.v3.request({
        method: 'eth_sendTransaction',
        params: [signedTx],
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const testReceipt = await providers.v3.request({
        method: 'eth_getTransactionReceipt',
        params: [testTx],
      })
      assert(testReceipt?.status, 'Receipt status is undefined')
      expect(fromRpcStatus[testReceipt.status]).toBe('success')
    })
  }, 30_000)
})
