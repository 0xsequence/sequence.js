import { LocalRelayer } from '@0xsequence/relayerv2'
import { Orchestrator } from '@0xsequence/signhubv2'
import { v1, commons as v2commons } from '@0xsequence/v2core'
import { Wallet as V1Wallet } from '@0xsequence/v2wallet' // V1 and V2 wallets share the same implementation
import { Envelope, Wallet as V3Wallet } from '@0xsequence/wallet-core'
import {
  Payload,
  Config as V3Config,
  Context as V3Context,
  Extensions as V3Extensions,
} from '@0xsequence/wallet-primitives'
import { ethers } from 'ethers'
import { AbiFunction, Address, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { assert, beforeEach, describe, expect, it } from 'vitest'
import { MIGRATION_V1_V3_NONCE_SPACE, Migration_v1v3 } from '../src/migrations/v1/migration_v1_v3.js'
import { UnsignedMigration, VersionedContext } from '../src/migrator.js'
import { createMultiSigner, MultiSigner, V1WalletType } from './testUtils.js'
import { fromRpcStatus } from 'ox/TransactionReceipt'

describe('Migration_v1v3', () => {
  let anvilSigner: MultiSigner
  let testSigner: MultiSigner

  let providers: {
    v2: ethers.Provider
    v3: Provider.Provider
  }
  let chainId: number

  let migration: Migration_v1v3

  let v1Config: v1.config.WalletConfig
  let v1Wallet: V1WalletType
  let testAddress: Address.Address

  beforeEach(async () => {
    migration = new Migration_v1v3()
    const url = 'http://127.0.0.1:8545'
    providers = {
      v2: ethers.getDefaultProvider(url),
      v3: Provider.from(RpcTransport.fromHttp(url)),
    }
    chainId = Number(await providers.v3.request({ method: 'eth_chainId' }))
    const anvilPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    anvilSigner = createMultiSigner(anvilPk, providers.v2)
    testAddress = '0x742d35cc6635c0532925a3b8d563a6b35b7f05f1'
    testSigner = createMultiSigner(Secp256k1.randomPrivateKey(), providers.v2)
    console.log('testSigner', testSigner.address)
    v1Config = {
      version: 1,
      threshold: 1,
      signers: [
        {
          weight: 1,
          address: testSigner.address,
        },
      ],
    }
    const orchestrator = new Orchestrator([testSigner.v2])
    v1Wallet = await V1Wallet.newWallet<
      v1.config.WalletConfig,
      v1.signature.Signature,
      v1.signature.UnrecoveredSignature
    >({
      context: v1.DeployedWalletContext,
      chainId: 42161,
      coders: {
        config: v1.config.ConfigCoder,
        signature: v1.signature.SignatureCoder,
      },
      orchestrator,
      config: v1Config,
      relayer: new LocalRelayer(anvilSigner.v2),
    })
  })

  describe('convertConfig', () => {
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

  describe('prepareMigration', () => {
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

      const migrationResult = await migration.prepareMigration(walletAddress, contexts, v3Config)

      expect(migrationResult.fromVersion).toBe(1)
      expect(migrationResult.toVersion).toBe(3)
      expect(migrationResult.transactions).toHaveLength(2)
      expect(migrationResult.nonce).toBeDefined()

      // Check first transaction (update implementation)
      const updateImplTx = migrationResult.transactions[0]
      expect(updateImplTx.to).toBe(walletAddress)

      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const decodedImplArgs = AbiFunction.decodeData(updateImplementationAbi, updateImplTx.data)
      expect(decodedImplArgs[0].toLowerCase()).toBe(V3Context.Rc3.stage2.toLowerCase())

      // Check second transaction (update image hash)
      const updateImageHashTx = migrationResult.transactions[1]
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

      const migrationResult = await migration.prepareMigration(walletAddress, contexts, v3Config)

      const updateImplTx = migrationResult.transactions[0]
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

      await expect(migration.prepareMigration(walletAddress, contexts, v3Config)).rejects.toThrow('Invalid context')
    })
  })

  describe('signMigration', () => {
    it('should sign migration correctly', async () => {
      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')

      const unsignedMigration: UnsignedMigration = {
        transactions: [
          {
            to: Address.from(v1Wallet.address),
            data: AbiFunction.encodeData(updateImplementationAbi, [V3Context.Rc3.stage2]),
          },
          {
            to: Address.from(v1Wallet.address),
            data: AbiFunction.encodeData(updateImageHashAbi, [
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            ]),
          },
        ],
        nonce: 123n,
        fromVersion: 1,
        toVersion: 3,
      }

      const signedMigration = await migration.signMigration(unsignedMigration, v1Wallet)

      expect(signedMigration.signature).toBeDefined()
      expect(signedMigration.fromVersion).toBe(1)
      expect(signedMigration.toVersion).toBe(3)
      expect(signedMigration.transactions).toEqual(unsignedMigration.transactions)
      expect(signedMigration.nonce).toBe(123n)

      // Note: We can't easily mock the internal signTransactionBundle call since it's part of the wallet
      // The test verifies that the migration was signed successfully
    })

    it('should throw error when wallet address does not match migration address', async () => {
      const differentAddress = '0x9999999999999999999999999999999999999999'
      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')

      const unsignedMigration: UnsignedMigration = {
        transactions: [
          {
            to: differentAddress,
            data: AbiFunction.encodeData(updateImplementationAbi, [V3Context.Rc3.stage2]),
          },
          {
            to: differentAddress,
            data: AbiFunction.encodeData(updateImageHashAbi, [
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            ]),
          },
        ],
        nonce: 123n,
        fromVersion: 1,
        toVersion: 3,
      }

      await expect(migration.signMigration(unsignedMigration, v1Wallet)).rejects.toThrow(
        'Wallet address does not match migration address',
      )
    })
  })

  describe('decodeTransactions', () => {
    it('should decode transactions correctly', async () => {
      const walletAddress = testAddress
      const imageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')

      const transactions = [
        {
          to: walletAddress,
          data: AbiFunction.encodeData(updateImplementationAbi, [V3Context.Rc3.stage2]),
        },
        {
          to: walletAddress,
          data: AbiFunction.encodeData(updateImageHashAbi, [imageHash]),
        },
      ]

      const decoded = await migration.decodeTransactions(transactions)

      expect(decoded.address).toBe(walletAddress)
      expect(decoded.toImageHash).toBe(imageHash)
    })

    it('should throw error for invalid number of transactions', async () => {
      const transactions: UnsignedMigration['transactions'] = [
        {
          to: testAddress,
          data: '0x1234567890abcdef',
        },
      ]

      await expect(migration.decodeTransactions(transactions)).rejects.toThrow('Invalid transactions')
    })

    it('should throw error when transaction addresses do not match', async () => {
      const differentAddress = '0x9999999999999999999999999999999999999999'
      const updateImplementationAbi = AbiFunction.from('function updateImplementation(address implementation)')
      const updateImageHashAbi = AbiFunction.from('function updateImageHash(bytes32 imageHash)')

      const transactions: UnsignedMigration['transactions'] = [
        {
          to: testAddress,
          data: AbiFunction.encodeData(updateImplementationAbi, [V3Context.Rc3.stage2]),
        },
        {
          to: differentAddress,
          data: AbiFunction.encodeData(updateImageHashAbi, [
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          ]),
        },
      ]

      await expect(migration.decodeTransactions(transactions)).rejects.toThrow('Invalid to address')
    })

    it('should throw error for invalid transaction data', async () => {
      const transactions: UnsignedMigration['transactions'] = [
        {
          to: testAddress,
          data: '0xinvalid',
        },
        {
          to: testAddress,
          data: '0xalsoinvalid',
        },
      ]

      await expect(migration.decodeTransactions(transactions)).rejects.toThrow()
    })
  })

  describe('constants', () => {
    it('should have correct nonce space', () => {
      expect(MIGRATION_V1_V3_NONCE_SPACE).toBe('0x9e4d5bdafd978baf1290aff23057245a2a62bef5')
    })

    it('should have correct version numbers', () => {
      expect(migration.fromVersion).toBe(1)
      expect(migration.toVersion).toBe(3)
    })
  })

  describe('integration test', () => {
    it('should perform complete migration flow', async () => {
      // Create v1 config
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
      const unsignedMigration = await migration.prepareMigration(Address.from(v1Wallet.address), contexts, v3Config)

      // Sign migration
      const signedMigration = await migration.signMigration(unsignedMigration, v1Wallet)

      // Verify signed migration
      expect(signedMigration.signature).toBeDefined()
      expect(signedMigration.fromVersion).toBe(1)
      expect(signedMigration.toVersion).toBe(3)
      expect(signedMigration.transactions).toHaveLength(2)

      // Decode transactions
      const decoded = await migration.decodeTransactions(signedMigration.transactions)
      expect(decoded.address).toBe(v1Wallet.address)
      expect(decoded.toImageHash).toBe(Hex.fromBytes(V3Config.hashConfiguration(v3Config)))

      // Send it
      const signedTxBundle: v2commons.transaction.IntendedTransactionBundle = {
        entrypoint: v1Wallet.address,
        transactions: signedMigration.transactions,
        nonce: signedMigration.nonce,
        chainId,
        intent: {
          id: '1',
          wallet: v1Wallet.address,
        },
      }
      const tx = await v1Wallet.sendSignedTransaction(signedTxBundle)
      console.log('tx', tx)
      const receipt = await tx.wait()
      console.log('receipt', receipt)
      expect(receipt?.status).toBe(1)

      // Test the wallet works as a v3 wallet now with a test transaction
      const v3Wallet = await V3Wallet.fromConfiguration(v3Config)
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
      console.log(`V3 transaction: ${signedTx.to} ${signedTx.data}`)
      const testTx = await providers.v3.request({
        method: 'eth_sendTransaction',
        params: [signedTx],
      })
      console.log(`V3 transaction sent ${testTx}`)
      const testReceipt = await providers.v3.request({
        method: 'eth_getTransactionReceipt',
        params: [testTx],
      })
      console.log(`V3 transaction successful! ${JSON.stringify(testReceipt)}`)
      assert(testReceipt?.status, 'Receipt status is undefined')
      expect(fromRpcStatus[testReceipt.status]).toBe('success')
    })
  }, 30_000)
})
