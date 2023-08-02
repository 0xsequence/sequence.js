import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'
import { LocalRelayer } from '@0xsequence/relayer'
import { ethers } from 'ethers'
import { configureLogger } from '@0xsequence/utils'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')

const { expect } = chai.use(chaiAsPromised)

configureLogger({ logLevel: 'DEBUG', silence: false })

import { SequenceOrchestratorWrapper, Wallet, WalletV2 } from '@0xsequence/wallet'
import { simulate } from '../src'
import { encodeData } from '@0xsequence/wallet/tests/utils'
import { context } from '@0xsequence/tests'
import { commons, v2 } from '@0xsequence/core'
import { Orchestrator } from '@0xsequence/signhub'

describe('Wallet integration', function () {
  let contexts: Awaited<ReturnType<typeof context.deploySequenceContexts>>
  let provider: ethers.providers.JsonRpcProvider
  let signers: ethers.Signer[]

  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock

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

    // Deploy local relayer
    relayer = new LocalRelayer({ signer: signers[0] })
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
            checkpoint: 0,
            signers: signers.map(s => ({ weight: 1, address: s.address }))
          })

          return Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config,
            provider,
            relayer,
            orchestrator: new Orchestrator(signers.slice(0, 3)),
            chainId: provider.network.chainId
          })
        }
      },
      {
        name: 'many multiple signers wallet',
        getWallet: async () => {
          const signers = new Array(111).fill(0).map(() => ethers.Wallet.createRandom())

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 77,
            checkpoint: 0,
            signers: signers.map(s => ({ weight: 1, address: s.address }))
          })

          return Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config,
            provider,
            relayer,
            orchestrator: new Orchestrator(signers.slice(0, 77)),
            chainId: provider.network.chainId
          })
        }
      },
      {
        name: 'nested wallet',
        getWallet: async () => {
          const EOASigners = new Array(3).fill(0).map(() => ethers.Wallet.createRandom())
          const nestedSigners = await Promise.all(
            new Array(2).fill(0).map(async () => {
              const signers = new Array(3).fill(0).map(() => ethers.Wallet.createRandom())
              const config = v2.config.ConfigCoder.fromSimple({
                threshold: 2,
                checkpoint: 0,
                signers: signers.map(s => ({ weight: 1, address: s.address }))
              })

              const wallet = Wallet.newWallet({
                context: contexts[2],
                coders: v2.coders,
                config,
                provider,
                relayer,
                orchestrator: new Orchestrator(signers.slice(0, 2)),
                chainId: provider.network.chainId
              })

              await wallet.deploy()

              return wallet
            })
          )

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 2,
            checkpoint: 0,
            signers: [
              ...EOASigners.map(s => ({ weight: 1, address: s.address })),
              ...nestedSigners.map(s => ({ weight: 1, address: s.address }))
            ]
          })

          return Wallet.newWallet({
            context: contexts[2],
            coders: v2.coders,
            config,
            provider,
            relayer,
            orchestrator: new Orchestrator([
              ...EOASigners.slice(0, 2),
              ...nestedSigners.slice(0, 1).map(s => new SequenceOrchestratorWrapper(s))
            ]),
            chainId: provider.network.chainId
          })
        }
      },
      {
        name: 'asymetrical signers wallet',
        getWallet: async () => {
          const signersA = new Array(5).fill(0).map(() => ethers.Wallet.createRandom())
          const signersB = new Array(6).fill(0).map(() => ethers.Wallet.createRandom())

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 5,
            checkpoint: 0,
            signers: [
              ...signersA.map(s => ({ weight: 1, address: s.address })),
              ...signersB.map(s => ({ weight: 10, address: s.address }))
            ]
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
              const results = await simulate(provider, wallet.address, txs)

              expect(results).to.have.lengthOf(txs.length)
              expect(results.every(result => result.executed)).to.be.true
              expect(results.every(result => result.succeeded)).to.be.true
              expect(results.every(result => result.gasUsed.gt(0))).to.be.true
            })

            it('should use estimated gas for a single failing transaction', async () => {
              await callReceiver.setRevertFlag(true)

              const results = await simulate(provider, wallet.address, txs)

              expect(results).to.have.lengthOf(txs.length)
              expect(results.every(result => result.executed)).to.be.true
              expect(results.every(result => !result.succeeded)).to.be.true
              expect(results.every(result => result.gasUsed.gt(0))).to.be.true
            })
          })

          describe('a batch of transactions', () => {
            let valB: Uint8Array

            beforeEach(async () => {
              await callReceiver.setRevertFlag(false)
              valB = ethers.utils.randomBytes(99)

              txs = [
                {
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 0,
                  to: callReceiver.address,
                  value: ethers.constants.Zero,
                  data: await encodeData(callReceiver, 'setRevertFlag', true)
                },
                {
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 0,
                  to: callReceiver.address,
                  value: ethers.constants.Zero,
                  data: await encodeData(callReceiver, 'testCall', 2, valB)
                }
              ]
            })

            it('should use estimated gas for a batch of transactions', async () => {
              const results = await simulate(provider, wallet.address, txs)

              expect(results).to.have.lengthOf(txs.length)
              expect(results[0].executed).to.be.true
              expect(results[0].succeeded).to.be.true
              expect(results[0].gasUsed.gt(0)).to.be.true
              expect(results[1].executed).to.be.true
              expect(results[1].succeeded).to.be.false
              expect(results[1].gasUsed.gt(0)).to.be.true
            })
          })
        })
      })
    })
  })
})
