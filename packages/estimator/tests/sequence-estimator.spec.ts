import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'

import { LocalRelayer } from '@0xsequence/relayer'
import { ethers } from 'ethers'

import { configureLogger } from '@0xsequence/utils'
import { commons, v2 } from '@0xsequence/core'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import { SequenceOrchestratorWrapper, Wallet, WalletV2 } from '@0xsequence/wallet'
import { OverwriterSequenceEstimator } from '../src'
import { OverwriterEstimator } from '../dist/0xsequence-estimator.cjs'
import { encodeData } from '@0xsequence/wallet/tests/utils'
import { context } from '@0xsequence/tests'
import { Orchestrator } from '@0xsequence/signhub'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const HookCallerMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/HookCallerMock.sol/HookCallerMock.json')

const { expect } = chai.use(chaiAsPromised)

configureLogger({ logLevel: 'DEBUG', silence: false })

describe('Wallet integration', function () {
  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock
  let hookCaller: HookCallerMock

  let contexts: Awaited<ReturnType<typeof context.deploySequenceContexts>>
  let provider: ethers.providers.JsonRpcProvider
  let signers: ethers.Signer[]

  let estimator: OverwriterSequenceEstimator

  before(async () => {
    const url = 'http://127.0.0.1:10045/'
    provider = new ethers.providers.JsonRpcProvider(url)

    signers = new Array(8).fill(0).map((_, i) => provider.getSigner(i))

    contexts = await context.deploySequenceContexts(signers[0])
    relayer = new LocalRelayer(signers[0])

    // Deploy call receiver mock
    callReceiver = (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      signers[0]
    ).deploy({ gasLimit: 1000000 })) as CallReceiverMock

    // Deploy hook caller mock
    hookCaller = (await new ethers.ContractFactory(
      HookCallerMockArtifact.abi,
      HookCallerMockArtifact.bytecode,
      signers[0]
    ).deploy({ gasLimit: 1000000 })) as HookCallerMock

    // Deploy local relayer
    relayer = new LocalRelayer({ signer: signers[0] })

    // Create gas estimator
    estimator = new OverwriterSequenceEstimator(new OverwriterEstimator({ rpc: provider }))
  })

  beforeEach(async () => {
    await callReceiver.setRevertFlag(false)
    await callReceiver.testCall(0, [])
  })

  describe('estimate gas of transactions', () => {
    const options = [
      {
        name: 'single signer wallet',
        getWallet: async () => {
          // const pk = ethers.utils.randomBytes(32)
          // const wallet = await Wallet.singleOwner(pk, context)
          // return wallet.connect(ethnode.provider, relayer)
          const signer = ethers.Wallet.createRandom()
          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 1,
            checkpoint: 0,
            signers: [{ weight: 1, address: signer.address }]
          })

          return Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config,
            provider,
            relayer,
            orchestrator: new Orchestrator([signer]),
            chainId: provider.network.chainId
          })
        }
      },
      {
        name: 'multiple signers wallet',
        getWallet: async () => {
          const signers = new Array(4).fill(0).map(() => ethers.Wallet.createRandom())

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 3,
            checkpoint: 100,
            signers: signers.map(s => ({ weight: 1, address: s.address }))
          })

          return Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config,
            provider,
            relayer,
            orchestrator: new Orchestrator([signers[0], signers[1], signers[2]]),
            chainId: provider.network.chainId
          })
        }
      },
      // TODO: This test fails because the gas estimation uses signers that are packed together
      // in the tree, we need to modify the estimator so it picks a sparse set of signers
      // {
      //   name: 'many multiple signers wallet',
      //   getWallet: async () => {
      //     const signers = new Array(111).fill(0).map(() => ethers.Wallet.createRandom())

      //     const config = v2.config.ConfigCoder.fromSimple({
      //       threshold: 11,
      //       checkpoint: 100,
      //       signers: signers.map(s => ({ weight: 1, address: s.address }))
      //     })

      //     console.log(JSON.stringify(config, null, 2))

      //     return Wallet.newWallet({
      //       context: contexts[2],
      //       coders: v2.coders,
      //       config,
      //       provider,
      //       relayer,
      //       orchestrator: new Orchestrator(signers.slice(0, 12)),
      //       chainId: provider.network.chainId
      //     })
      //   }
      // },
      {
        name: 'nested wallet',
        getWallet: async () => {
          const EOAsigners = new Array(3).fill(0).map(() => ethers.Wallet.createRandom())

          const nestedSigners = new Array(3).fill(0).map(() => ethers.Wallet.createRandom())
          const nestedConfig = v2.config.ConfigCoder.fromSimple({
            threshold: 2,
            checkpoint: 0,
            signers: nestedSigners.map(s => ({ weight: 1, address: s.address }))
          })

          const nestedWallet = Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config: nestedConfig,
            provider,
            relayer,
            orchestrator: new Orchestrator([nestedSigners[0], nestedSigners[1]]),
            chainId: provider.network.chainId
          })

          await nestedWallet.deploy()

          const signers = [nestedWallet, ...EOAsigners]

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 3,
            checkpoint: 0,
            signers: signers.map(s => ({ weight: 1, address: s.address }))
          })

          return Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config,
            provider,
            relayer,
            orchestrator: new Orchestrator([new SequenceOrchestratorWrapper(nestedWallet), EOAsigners[0], EOAsigners[1]]),
            chainId: provider.network.chainId
          })
        }
      },
      {
        name: 'asymetrical signers wallet',
        getWallet: async () => {
          const signersA = new Array(5).fill(0).map(() => ethers.Wallet.createRandom())
          const signersB = new Array(6).fill(0).map(() => ethers.Wallet.createRandom())

          const signers = [...signersA, ...signersB]

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 5,
            checkpoint: 0,
            signers: signers.map((s, i) => ({ weight: i <= signersA.length ? 1 : 10, address: s.address }))
          })

          return Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config,
            provider,
            relayer,
            orchestrator: new Orchestrator(signersA),
            chainId: provider.network.chainId
          })
        }
      }
    ]

    options.map(o => {
      describe(`with ${o.name}`, () => {
        let wallet: WalletV2

        beforeEach(async () => {
          wallet = await o.getWallet()
        })

        describe('with deployed wallet', () => {
          let txs: commons.transaction.Transaction[]

          beforeEach(async () => {
            await callReceiver.testCall(0, [])
            await wallet.deploy()
          })

          describe('a single transaction', () => {
            beforeEach(async () => {
              txs = [
                {
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 0,
                  to: callReceiver.address,
                  value: ethers.constants.Zero,
                  data: await encodeData(callReceiver, 'testCall', 14442, '0x112233')
                }
              ]
            })

            it('should use estimated gas for a single transaction', async () => {
              const estimation = await estimator.estimateGasLimits(wallet.address, wallet.config, wallet.context, 0, ...txs)
              const realTx = await (await wallet.sendTransaction(estimation.transactions)).wait(1)

              expect(realTx.gasUsed.toNumber()).to.be.approximately(estimation.total.toNumber(), 10000)
              expect(realTx.gasUsed.toNumber()).to.be.below(estimation.total.toNumber())

              expect((await callReceiver.lastValA()).toNumber()).to.equal(14442)
            })

            it('should predict gas usage for a single transaction', async () => {
              const estimation = await estimator.estimateGasLimits(wallet.address, wallet.config, wallet.context, 0, ...txs)
              const realTx = await (await wallet.sendTransaction(txs)).wait(1)

              expect(realTx.gasUsed.toNumber()).to.be.approximately(estimation.total.toNumber(), 10000)
              expect(realTx.gasUsed.toNumber()).to.be.below(estimation.total.toNumber())

              expect((await callReceiver.lastValA()).toNumber()).to.equal(14442)
            })

            it('should use estimated gas for a single failing transaction', async () => {
              await callReceiver.setRevertFlag(true)
              const estimation = await estimator.estimateGasLimits(wallet.address, wallet.config, wallet.context, 0, ...txs)
              const realTx = await (await wallet.sendTransaction(estimation.transactions)).wait(1)

              expect(realTx.gasUsed.toNumber()).to.be.approximately(estimation.total.toNumber(), 10000)
              expect(realTx.gasUsed.toNumber()).to.be.below(estimation.total.toNumber())

              expect((await callReceiver.lastValA()).toNumber()).to.equal(0)
            })
          })

          describe('a batch of transactions', () => {
            let valB: Uint8Array

            beforeEach(async () => {
              await callReceiver.setRevertFlag(true)
              valB = ethers.utils.randomBytes(99)

              txs = [
                {
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 0,
                  to: callReceiver.address,
                  value: ethers.constants.Zero,
                  data: await encodeData(callReceiver, 'setRevertFlag', false)
                },
                {
                  delegateCall: false,
                  revertOnError: true,
                  gasLimit: 0,
                  to: callReceiver.address,
                  value: ethers.constants.Zero,
                  data: await encodeData(callReceiver, 'testCall', 2, valB)
                }
              ]
            })

            it('should use estimated gas for a batch of transactions', async () => {
              const estimation = await estimator.estimateGasLimits(wallet.address, wallet.config, wallet.context, 0, ...txs)
              const realTx = await (await wallet.sendTransaction(estimation.transactions)).wait(1)

              expect(realTx.gasUsed.toNumber()).to.be.approximately(estimation.total.toNumber(), 30000)
              expect(realTx.gasUsed.toNumber()).to.be.below(estimation.total.toNumber())

              expect(ethers.utils.hexlify(await callReceiver.lastValB())).to.equal(ethers.utils.hexlify(valB))
            })
          })
        })
      })
    })
  })
})
