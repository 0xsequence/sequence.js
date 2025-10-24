import { LocalRelayer } from '@0xsequence/relayerv2'
import { Orchestrator } from '@0xsequence/signhubv2'
import { v2 } from '@0xsequence/v2core'
import { Wallet as V2Wallet } from '@0xsequence/v2wallet'
import { Envelope, State } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { ethers } from 'ethers'
import { Address, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { fromRpcStatus } from 'ox/TransactionReceipt'
import { assert, beforeEach, describe, expect, it } from 'vitest'
import { Migrator_v2v3, MigratorV2V3Options } from '../../src/migrations/v2/migrator_v2_v3.js'
import { createAnvilSigner, createMultiSigner, type MultiSigner } from '../testUtils.js'

describe('Migrator_v2v3', async () => {
  let testSigner: MultiSigner

  let providers: {
    v2: ethers.Provider
    v3: Provider.Provider
  }
  let chainId: number

  let stateProvider: State.Provider

  let migrator: Migrator_v2v3

  beforeEach(async () => {
    const url = 'http://127.0.0.1:8545'
    providers = {
      v2: ethers.getDefaultProvider(url),
      v3: Provider.from(RpcTransport.fromHttp(url)),
    }
    chainId = Number(await providers.v3.request({ method: 'eth_chainId' }))

    stateProvider = new State.Local.Provider()
    // stateProvider = new State.Sequence.Provider('http://127.0.0.1:36261')
    migrator = new Migrator_v2v3(stateProvider)

    testSigner = createMultiSigner(Secp256k1.randomPrivateKey(), providers.v2)
  })

  describe('convertWallet', async () => {
    it('should convert a v2 wallet to a v3 wallet', async () => {
      const v2Config = {
        version: 2,
        threshold: 1,
        checkpoint: 0,
        tree: {
          left: {
            weight: 1,
            address: testSigner.address,
          },
          right: {
            weight: 1,
            address: Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() })),
          },
        },
      }
      const orchestrator = new Orchestrator([testSigner.v2])
      const anvilSigner = await createAnvilSigner(providers.v2, providers.v3)
      const v2Wallet = await V2Wallet.newWallet<
        v2.config.WalletConfig,
        v2.signature.Signature,
        v2.signature.UnrecoveredSignature
      >({
        context: v2.DeployedWalletContext,
        chainId,
        coders: {
          config: v2.config.ConfigCoder,
          signature: v2.signature.SignatureCoder,
        },
        orchestrator,
        config: v2Config,
        relayer: new LocalRelayer(anvilSigner.v2),
      })
      const v2ImageHash = v2.config.ConfigCoder.imageHashOf(v2Config)

      const options: MigratorV2V3Options = {
        loginSigner: {
          address: testSigner.address,
        },
      }
      const v3Wallet = await migrator.convertWallet(v2Wallet, options)

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
