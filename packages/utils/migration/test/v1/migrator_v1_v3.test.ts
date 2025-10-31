import { LocalRelayer } from '@0xsequence/relayerv2'
import { Orchestrator } from '@0xsequence/signhubv2'
import { v1 } from '@0xsequence/v2core'
import { Wallet as V1Wallet } from '@0xsequence/v2wallet' // V1 and V2 wallets share the same implementation
import { Envelope, State } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { ethers } from 'ethers'
import { Address, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { fromRpcStatus } from 'ox/TransactionReceipt'
import { assert, beforeEach, describe, expect, it } from 'vitest'
import { Migrator_v1v3, MigratorV1V3Options } from '../../src/migrations/v1/migrator_v1_v3.js'
import { createAnvilSigner, createMultiSigner, type MultiSigner } from '../testUtils.js'

describe('Migrator_v1v3', async () => {
  let testSigner: MultiSigner

  let providers: {
    v2: ethers.Provider
    v3: Provider.Provider
  }
  let chainId: number

  let stateProvider: State.Provider

  let migrator: Migrator_v1v3

  beforeEach(async () => {
    const url = 'http://127.0.0.1:8545'
    providers = {
      v2: ethers.getDefaultProvider(url),
      v3: Provider.from(RpcTransport.fromHttp(url)),
    }
    chainId = Number(await providers.v3.request({ method: 'eth_chainId' }))

    stateProvider = new State.Local.Provider()
    // stateProvider = new State.Sequence.Provider('http://127.0.0.1:36261')
    migrator = new Migrator_v1v3(stateProvider)

    testSigner = createMultiSigner(Secp256k1.randomPrivateKey(), providers.v2)
  })

  describe('convertWallet', async () => {
    it('should convert a v1 wallet to a v3 wallet', async () => {
      const v1Config = {
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
      const orchestrator = new Orchestrator([testSigner.v2])
      const anvilSigner = await createAnvilSigner(providers.v2, providers.v3)
      const v1Wallet = await V1Wallet.newWallet<
        v1.config.WalletConfig,
        v1.signature.Signature,
        v1.signature.UnrecoveredSignature
      >({
        context: v1.DeployedWalletContext,
        chainId,
        coders: {
          config: v1.config.ConfigCoder,
          signature: v1.signature.SignatureCoder,
        },
        orchestrator,
        config: v1Config,
        relayer: new LocalRelayer(anvilSigner.v2),
      })
      const v1ImageHash = v1.config.ConfigCoder.imageHashOf(v1Config)

      const options: MigratorV1V3Options = {
        loginSigner: {
          address: testSigner.address,
        },
      }
      const v3Wallet = await migrator.convertWallet(v1Wallet, options)

      // Test the wallet works as a v3 wallet now with a test transaction
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
      const receipt = await providers.v3.request({
        method: 'eth_getTransactionReceipt',
        params: [testTx],
      })
      assert(receipt?.status, 'Receipt status is undefined')
      expect(fromRpcStatus[receipt.status]).toBe('success')
    })
  }, 30_000)
})
