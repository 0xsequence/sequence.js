import { commons, v2 } from '@0xsequence/core'
import { Orchestrator } from '@0xsequence/signhub'
import { context } from '@0xsequence/tests'
import { Wallet, WalletV2 } from '@0xsequence/wallet'
import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ethers } from 'ethers'
import hardhat from 'hardhat'
import { LocalRelayer } from '../src'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const HookCallerMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/HookCallerMock.sol/HookCallerMock.json')

const { expect } = chai.use(chaiAsPromised)

describe('Wallet integration', function () {
  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock
  let hookCaller: HookCallerMock

  let contexts: Awaited<ReturnType<typeof context.deploySequenceContexts>>
  let provider: ethers.BrowserProvider
  let signers: ethers.Signer[]

  before(async () => {
    provider = new ethers.BrowserProvider(hardhat.network.provider, undefined, { cacheTimeout: -1 })
    signers = await Promise.all(new Array(8).fill(0).map((_, i) => provider.getSigner(i)))
    contexts = await context.deploySequenceContexts(signers[0])
    relayer = new LocalRelayer(signers[1])

    // Deploy call receiver mock
    callReceiver = (await new ethers.ContractFactory(CallReceiverMockArtifact.abi, CallReceiverMockArtifact.bytecode, signers[0])
      .deploy()
      .then(tx => tx.waitForDeployment())) as CallReceiverMock

    // Deploy hook caller mock
    hookCaller = (await new ethers.ContractFactory(HookCallerMockArtifact.abi, HookCallerMockArtifact.bytecode, signers[0])
      .deploy()
      .then(tx => tx.waitForDeployment())) as HookCallerMock
  })

  describe('Waiting for receipts', () => {
    ;[
      {
        name: 'deployed',
        deployed: true
      },
      {
        name: 'undeployed',
        deployed: false
      }
    ].map(c => {
      let wallet: WalletV2

      beforeEach(async () => {
        const signer = ethers.Wallet.createRandom()
        const orchestrator = new Orchestrator([signer])

        const network = await provider.getNetwork()

        const config = v2.config.ConfigCoder.fromSimple({
          threshold: 1,
          checkpoint: 0,
          signers: [
            {
              address: signer.address,
              weight: 1
            }
          ]
        })

        wallet = Wallet.newWallet({
          coders: v2.coders,
          context: contexts[2],
          config,
          orchestrator,
          chainId: network.chainId,
          provider,
          relayer
        })

        if (c.deployed) await wallet.deploy()

        expect(await wallet.reader().isDeployed(wallet.address)).to.equal(c.deployed)
      })

      describe(`For ${c.name} wallet`, () => {
        it('Should get receipt of success transaction', async () => {
          const txn: commons.transaction.Transaction = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.hexlify(ethers.randomBytes(43)),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0
          }

          const network = await provider.getNetwork()

          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, 0, [txn])

          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))

          const ogtx = await wallet.sendTransaction(txn, { serial: true })
          const receipt = await receiptPromise

          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })

        it('Should get receipt of success batch transaction', async () => {
          const txns: commons.transaction.Transaction[] = [
            {
              to: ethers.Wallet.createRandom().address,
              data: ethers.hexlify(ethers.randomBytes(43)),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0
              // nonce: 0
            },
            {
              to: ethers.Wallet.createRandom().address,
              data: ethers.hexlify(ethers.randomBytes(43)),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0
              // nonce: 0
            }
          ]

          const network = await provider.getNetwork()

          const nonce = 0 //wallet.randomNonce()
          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, nonce, txns)

          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))

          const ogtx = await wallet.sendTransaction(txns, { nonce })
          const receipt = await receiptPromise

          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })

        it('Should get receipt of batch transaction with failed meta-txs', async () => {
          const txns: commons.transaction.Transaction[] = [
            {
              to: ethers.Wallet.createRandom().address,
              data: ethers.hexlify(ethers.randomBytes(43)),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0
              // nonce: 0
            },
            {
              to: contexts[2].factory,
              // 0xff not a valid factory method
              data: '0xffffffffffff',
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0
              // nonce: 0
            }
          ]

          const network = await provider.getNetwork()
          const nonce = wallet.randomNonce()
          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, nonce, txns)

          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))

          const ogtx = await wallet.sendTransaction(txns, { nonce })
          const receipt = await receiptPromise

          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })

        it('Should get receipt of failed transaction', async () => {
          const txn: commons.transaction.Transaction = {
            to: contexts[1].factory,
            // 0xff not a valid factory method
            data: '0xffffffffffff',
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0
            // nonce: 0
          }

          const network = await provider.getNetwork()
          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, 0, [txn])

          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))

          const ogtx = await wallet.sendTransaction(txn, { serial: true })
          const receipt = await receiptPromise

          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })

        it('Find correct receipt between multiple other transactions', async () => {
          const altSigner = ethers.Wallet.createRandom()
          const orchestrator = new Orchestrator([altSigner])
          const network = await provider.getNetwork()

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 1,
            checkpoint: 0,
            signers: [
              {
                address: altSigner.address,
                weight: 1
              }
            ]
          })

          const altWallet = Wallet.newWallet({
            coders: v2.coders,
            context: contexts[2],
            config,
            provider,
            relayer,
            orchestrator,
            chainId: network.chainId
          })

          await altWallet.deploy()

          expect(await altWallet.reader().isDeployed(altWallet.address)).to.be.true

          await Promise.all(
            new Array(8).fill(0).map(async (_, i) => {
              await altWallet.sendTransaction(
                {
                  to: ethers.Wallet.createRandom().address,
                  data: ethers.hexlify(ethers.randomBytes(43)),
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 140000,
                  value: 0
                },
                { nonce: commons.transaction.encodeNonce(i, 0) }
              )
            })
          )

          const txn: commons.transaction.Transaction = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.hexlify(ethers.randomBytes(43)),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0
            // nonce: 0
          }

          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, 0, [txn])

          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))

          const ogtx = await wallet.sendTransaction(txn, { serial: true })

          // Post-txs
          await Promise.all(
            new Array(8).fill(0).map(async (_, i) => {
              await altWallet.sendTransaction(
                {
                  to: ethers.Wallet.createRandom().address,
                  data: ethers.hexlify(ethers.randomBytes(43)),
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 140000,
                  value: 0
                },
                { nonce: commons.transaction.encodeNonce(i + 1000, 0) }
              )
            })
          )

          const receipt = await receiptPromise

          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })

        it('Find correct receipt between multiple other failed transactions', async () => {
          // Pre-txs
          const altSigner = ethers.Wallet.createRandom()
          const orchestrator = new Orchestrator([altSigner])
          const network = await provider.getNetwork()

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 1,
            checkpoint: 0,
            signers: [
              {
                address: altSigner.address,
                weight: 1
              }
            ]
          })

          const altWallet = Wallet.newWallet({
            coders: v2.coders,
            context: contexts[2],
            config,
            provider,
            relayer,
            orchestrator,
            chainId: network.chainId
          })

          await Promise.all(
            new Array(8).fill(0).map(async (_, i) => {
              await altWallet.sendTransaction(
                {
                  to: ethers.Wallet.createRandom().address,
                  data: ethers.hexlify(ethers.randomBytes(43)),
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 140000,
                  value: 0
                },
                { nonce: commons.transaction.encodeNonce(i, 0) }
              )
            })
          )

          await Promise.all(
            new Array(8).fill(0).map(async (_, i) => {
              await altWallet.sendTransaction(
                {
                  to: contexts[2].factory,
                  // 0xff not a valid factory method
                  data: '0xffffffffffff',
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 140000,
                  value: 0
                },
                { nonce: commons.transaction.encodeNonce(i + 1000, 0) }
              )
            })
          )

          const txn: commons.transaction.Transaction = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.hexlify(ethers.randomBytes(43)),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0
            // nonce: 0
          }

          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, 0, [txn])

          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))

          const ogtx = await wallet.sendTransaction(txn, { serial: true })

          const receipt = await receiptPromise

          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })

        it('Find failed tx receipt between multiple other failed transactions', async () => {
          // Pre-txs
          const altSigner = ethers.Wallet.createRandom()
          const orchestrator = new Orchestrator([altSigner])
          const network = await provider.getNetwork()

          const config = v2.config.ConfigCoder.fromSimple({
            threshold: 1,
            checkpoint: 0,
            signers: [
              {
                address: altSigner.address,
                weight: 1
              }
            ]
          })

          const altWallet = Wallet.newWallet({
            coders: v2.coders,
            context: contexts[2],
            config,
            provider,
            relayer,
            orchestrator,
            chainId: network.chainId
          })

          await Promise.all(
            new Array(8).fill(0).map(async (_, i) => {
              await altWallet.sendTransaction(
                {
                  to: ethers.Wallet.createRandom().address,
                  data: ethers.hexlify(ethers.randomBytes(43)),
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 140000
                },
                { nonce: commons.transaction.encodeNonce(i, 0) }
              )
            })
          )

          await Promise.all(
            new Array(8).fill(0).map(async (_, i) => {
              await altWallet.sendTransaction(
                {
                  to: contexts[1].factory,
                  // 0xff not a valid factory method
                  data: '0xffffffffffff',
                  delegateCall: false,
                  revertOnError: false,
                  gasLimit: 140000
                },
                { nonce: commons.transaction.encodeNonce(i + 1000, 0) }
              )
            })
          )

          const txn: commons.transaction.Transaction = {
            to: contexts[2].factory,
            // 0xff not a valid factory method
            data: '0xffffffffffff',
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0
            // nonce: 0
          }

          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, 0, [txn])

          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))

          const ogtx = await wallet.sendTransaction(txn, { serial: true })
          const receipt = await receiptPromise

          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })

        it('Should timeout receipt if transaction is never sent', async () => {
          const txn: commons.transaction.Transaction = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.hexlify(ethers.randomBytes(43)),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0
            // nonce: 0
          }

          const network = await provider.getNetwork()

          const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, 0, [txn])
          const receiptPromise = relayer.wait(id, 2000)

          await expect(receiptPromise).to.be.rejectedWith(`Timeout waiting for transaction receipt ${id}`)
        })

        if (c.deployed) {
          it('Find correct receipt between multiple other failed transactions of the same wallet', async () => {
            // Pre-txs
            await Promise.all(
              new Array(8).fill(0).map(async (_, i) => {
                await wallet.sendTransaction(
                  {
                    to: ethers.Wallet.createRandom().address,
                    data: ethers.hexlify(ethers.randomBytes(43)),
                    delegateCall: false,
                    revertOnError: false,
                    gasLimit: 140000,
                    value: 0
                  },
                  { nonce: commons.transaction.encodeNonce(i + 1000, 0) }
                )
              })
            )

            await Promise.all(
              new Array(8).fill(0).map(async (_, i) => {
                await wallet.sendTransaction(
                  {
                    to: contexts[1].factory,
                    // 0xff not a valid factory method
                    data: '0xffffffffffff',
                    delegateCall: false,
                    revertOnError: false,
                    gasLimit: 140000,
                    value: 0
                  },
                  { nonce: commons.transaction.encodeNonce(i + 2000, 0) }
                )
              })
            )

            const txn: commons.transaction.Transaction = {
              to: ethers.Wallet.createRandom().address,
              data: ethers.hexlify(ethers.randomBytes(43)),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000
            }

            const network = await provider.getNetwork()

            const id = commons.transaction.subdigestOfTransactions(wallet.address, network.chainId, 0, [txn])

            const receiptPromise = relayer.wait(id, 10000)
            await new Promise(r => setTimeout(r, 1000))

            const ogtx = await wallet.sendTransaction(txn, { serial: true })

            const receipt = await receiptPromise

            expect(receipt).to.not.be.undefined
            expect(receipt.hash).to.equal(ogtx.hash)
          })
        }
      })
    })
  })
})
