import { LocalRelayer } from '@0xsequence/relayerv2'
import { Orchestrator } from '@0xsequence/signhubv2'
import { v1 } from '@0xsequence/v2core'
import { trackers as v2trackers } from '@0xsequence/v2sessions'
import { Wallet as V1Wallet } from '@0xsequence/v2wallet' // V1 and V2 wallets share the same implementation
import { Envelope, State } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { ethers } from 'ethers'
import { Address, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { assert, beforeEach, describe, expect, it } from 'vitest'
import { Migrator_v1v3, MigratorV1V3Options } from '../src/migrations/v1/migrator_v1_v3.js'
import { createMultiSigner, type MultiSigner, type V1WalletType } from './testUtils.js'
import { fromRpcStatus } from 'ox/TransactionReceipt'

describe('Migration_v1v3', () => {
  let anvilSigner: MultiSigner
  let testSigner: MultiSigner

  let providers: {
    v2: ethers.Provider
    v3: Provider.Provider
  }
  let chainId: number

  let tracker: v2trackers.local.LocalConfigTracker
  let stateProvider: State.Provider
  let migrator: Migrator_v1v3

  let v1Config: v1.config.WalletConfig
  let v1Wallet: V1WalletType
  let testAddress: Address.Address

  beforeEach(async () => {
    const url = 'http://127.0.0.1:8545'
    providers = {
      v2: ethers.getDefaultProvider(url),
      v3: Provider.from(RpcTransport.fromHttp(url)),
    }
    chainId = Number(await providers.v3.request({ method: 'eth_chainId' }))

    tracker = new v2trackers.local.LocalConfigTracker(providers.v2)
    stateProvider = new State.Local.Provider()
    migrator = new Migrator_v1v3() //tracker, stateProvider)

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

  describe('convertWallet', () => {
    it('should convert a v1 wallet to a v3 wallet', async () => {
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
      console.log(`V3 transaction: ${signedTx.to} ${signedTx.data}`)
      const testTx = await providers.v3.request({
        method: 'eth_sendTransaction',
        params: [signedTx],
      })
      console.log(`V3 transaction sent ${testTx}`)
      const receipt = await providers.v3.request({
        method: 'eth_getTransactionReceipt',
        params: [testTx],
      })
      console.log(`V3 transaction successful! ${JSON.stringify(receipt)}`)
      assert(receipt?.status, 'Receipt status is undefined')
      expect(fromRpcStatus[receipt.status]).toBe('success')
    })
  }, 30_000)
})
