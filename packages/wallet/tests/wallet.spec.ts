
import hardhat from 'hardhat'
import * as chai from 'chai'

import { commons, v1, v2 } from "@0xsequence/core"
import { context } from "@0xsequence/tests"
import { ethers } from 'ethers'
import { SequenceOrchestratorWrapper, Wallet } from '../src/index'
import { Orchestrator, signers as hubsigners } from '@0xsequence/signhub'
import { LocalRelayer } from '@0xsequence/relayer'
import { getEOAWallet, sendETH, testAccounts } from '../../0xsequence/tests/browser/testutils'

const { expect } = chai

type Coders = {
  signature: commons.signature.SignatureCoder<any, any, any>,
  config: commons.config.ConfigCoder<any>,
}

describe('Wallet (primitive)', () => {
  let provider: ethers.providers.JsonRpcProvider
  let signers: ethers.Signer[]

  let contexts: Awaited<ReturnType<typeof context.deploySequenceContexts>>
  let relayer: LocalRelayer

  before(async () => {
    provider = new ethers.providers.Web3Provider(hardhat.network.provider.send)
    signers = new Array(8).fill(0).map((_, i) => provider.getSigner(i))
    contexts = await context.deploySequenceContexts(signers[0])
    relayer = new LocalRelayer(signers[0])
  });

  ([{
    version: 1,
    coders: { signature: v1.signature.SignatureCoder, config: v1.config.ConfigCoder },
  }, {
    version: 2,
    coders: { signature: v2.signature.SignatureCoder, config: v2.config.ConfigCoder },
  }] as { version: number, coders: Coders }[]).map(({ version, coders }) => {
    describe(`Using v${version} version`, () => {
      it('Should deploy a new wallet', async () => {
        const signer = ethers.Wallet.createRandom()

        const config = coders.config.fromSimple({
          threshold: 1,
          checkpoint: 0,
          signers: [{ address: signer.address, weight: 1 }]
        })

        const wallet = Wallet.newWallet({
          coders: coders,
          context: contexts[version],
          config,
          orchestrator: new Orchestrator([new hubsigners.SignerWrapper(signer)]),
          chainId: provider.network.chainId,
          provider,
          relayer
        })

        await wallet.deploy()

        expect(await wallet.reader().isDeployed(wallet.address)).to.be.true
      });

      //
      // Run tests using different combinations of signers
      //
      ([{
          name: '1/1 signer',
          signers: () => {
            const signer = ethers.Wallet.createRandom()

            const config = coders.config.fromSimple({
              threshold: 1,
              checkpoint: 0,
              signers: [{ address: signer.address, weight: 1 }]
            })

            const orchestrator = new Orchestrator([new hubsigners.SignerWrapper(signer)])

            return { config, orchestrator }
          }
        }, {
          name: '1/2 signers',
          signers: () => {
            const signer = ethers.Wallet.createRandom()
            const signers = [{
              address: signer.address,
              weight: 1
            }, {
              address: ethers.Wallet.createRandom().address,
              weight: 1
            }].sort(() => Math.random() > 0.5 ? 1 : -1)

            const config = coders.config.fromSimple({
              threshold: 1,
              checkpoint: 0,
              signers
            })

            const orchestrator = new Orchestrator([new hubsigners.SignerWrapper(signer)])
            return { config, orchestrator }
          }
        }, {
          name: '2/4 signers',
          signers: () => {
            const members = new Array(4).fill(0).map(() => ethers.Wallet.createRandom())

            const signers = members.map((m) => ({
              address: m.address,
              weight: 2
            })).sort(() => Math.random() > 0.5 ? 1 : -1)

            const config = coders.config.fromSimple({
              threshold: 2,
              checkpoint: 0,
              signers
            })

            const orchestrator = new Orchestrator(members.slice(0, 2).map((m) => new hubsigners.SignerWrapper(m)))
            return { config, orchestrator }
          }
        }, {
          name: '11/90 signers',
          signers: () => {
            const members = new Array(90).fill(0).map(() => ethers.Wallet.createRandom())

            const signers = members.map((m) => ({
              address: m.address,
              weight: 1
            })).sort(() => Math.random() > 0.5 ? 1 : -1)

            const config = coders.config.fromSimple({
              threshold: 11,
              checkpoint: 0,
              signers
            })

            const orchestrator = new Orchestrator(members.slice(0, 11).map((m) => new hubsigners.SignerWrapper(m)))
            return { config, orchestrator }
          }
        }, {
        name: '1/1 signer (nested)',
        signers: async () => {
          const nestedSigner = ethers.Wallet.createRandom()

          const nestedConfig = coders.config.fromSimple({
            threshold: 1,
            checkpoint: 0,
            signers: [{ address: nestedSigner.address, weight: 1 }]
          })

          const nestedOrchestrator = new Orchestrator([nestedSigner])
          const nestedWallet = Wallet.newWallet({
            coders: coders,
            context: contexts[version],
            config: nestedConfig,
            orchestrator: nestedOrchestrator,
            chainId: provider.network.chainId,
            provider,
            relayer
          })

          await nestedWallet.deploy()
          expect(await nestedWallet.reader().isDeployed(nestedWallet.address)).to.be.true

          const config = coders.config.fromSimple({
            threshold: 1,
            checkpoint: 0,
            signers: [{ address: nestedWallet.address, weight: 1 }]
          })

          const orchestrator = new Orchestrator([new SequenceOrchestratorWrapper(nestedWallet)])

          return { config, orchestrator }
        }
      }]).map(({ name, signers }) => {
        describe(`Using ${name}`, () => {
          let orchestrator: Orchestrator
          let config: commons.config.Config

          beforeEach(async () => {
            const { config: _config, orchestrator: _orchestrator } = await signers()
            config = _config
            orchestrator = _orchestrator
          })


          it('Should sign and validate a message', async () => {
            const wallet = Wallet.newWallet({
              coders: coders,
              context: contexts[version],
              config,
              orchestrator,
              chainId: provider.network.chainId,
              provider,
              relayer
            })

            await wallet.deploy()
            expect(await wallet.reader().isDeployed(wallet.address)).to.be.true

            const message = ethers.utils.toUtf8Bytes(
              `This is a random message: ${ethers.utils.hexlify(ethers.utils.randomBytes(96))}`
            )

            const signature = await wallet.signMessage(message)
            const digest = ethers.utils.keccak256(message)

            expect(await wallet.reader().isValidSignature(wallet.address, digest, signature)).to.be.true
          });

          //
          // Run tests for deployed and undeployed wallets
          // transactions should be decorated automatically
          //
          ([{
            name: 'After deployment',
            setup: async (wallet: Wallet) => {
              await wallet.deploy()
            },
            deployed: true
          }, {
            name: 'Before deployment',
            setup: async (_: Wallet) => { },
            deployed: false
          }]).map(({ name, setup, deployed }) => {
            describe(name, () => {
              let wallet: Wallet
    
              beforeEach(async () => {
                wallet = Wallet.newWallet({
                  coders: coders,
                  context: contexts[version],
                  config,
                  orchestrator,
                  chainId: provider.network.chainId,
                  provider,
                  relayer
                })
    
                await setup(wallet)
              })
    
              it('Should send an empty list of transactions', async () => {
                await wallet.sendTransaction([])
              })
    
              it('Should send a transaction with an empty call', async () => {
                await wallet.sendTransaction([{
                  to: ethers.Wallet.createRandom().address
                }])
              })

              it('Should build and execute a wallet update transaction', async () => {
                const newConfig = coders.config.fromSimple({
                  threshold: 1,
                  checkpoint: 0,
                  signers: [{
                    address: ethers.Wallet.createRandom().address,
                    weight: 1
                  }]
                })

                const updateTx = await wallet.buildUpdateConfigurationTransaction(newConfig)

                expect(updateTx.entrypoint).to.equal(wallet.address)
                expect(updateTx.transactions[0].to).to.equal(wallet.address)
                expect(updateTx.transactions[0].delegateCall).to.equal(false)
                expect(updateTx.transactions[0].revertOnError).to.equal(true)
                expect(updateTx.transactions[0].gasLimit).to.equal(0)
                expect(updateTx.transactions[0].value).to.equal(0)

                if (version === 1) {
                  expect(updateTx.transactions.length).to.be.equal(2)
                  expect(updateTx.transactions[1].to).to.equal(wallet.address)
                  expect(updateTx.transactions[1].delegateCall).to.equal(false)
                  expect(updateTx.transactions[1].revertOnError).to.equal(true)
                  expect(updateTx.transactions[1].gasLimit).to.equal(0)
                  expect(updateTx.transactions[1].value).to.equal(0)
                } else if (version === 2) {
                  expect(updateTx.transactions.length).to.be.equal(1)
                } else {
                  throw new Error('Version not supported in test')
                }

                const prevImplentation = await wallet.reader().implementation(wallet.address)

                await wallet.sendTransaction(updateTx.transactions)

                expect(await wallet.reader().imageHash(wallet.address)).to.equal(coders.config.imageHashOf(newConfig))
                expect(await wallet.reader().implementation(wallet.address)).to.not.equal(prevImplentation)
              })

              describe.only('async transactions', async () => {
                const testAccount = getEOAWallet(testAccounts[1].privateKey)
                let toBalanceBefore

                beforeEach(async () => {
                  const ethAmount = ethers.utils.parseEther('100')
                  const txResp = await sendETH(testAccount, await wallet.getAddress(), ethAmount)
                  await provider.getTransactionReceipt(txResp.hash)
                  toBalanceBefore = await provider.getBalance(testAccount.address)
                })

                it('Should not allow nonce specified', async () => {
                  const ethAmount1 = ethers.utils.parseEther('1.0')
              
                  const tx: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount1
                  }

                  await expect(wallet.sendTransactionNonBlocking(tx)).to.be.rejectedWith('Cannot send async transaction with a defined nonce')
                })
        
                it('Should send an async transaction', async () => {
                  const ethAmount = ethers.utils.parseEther('1.0')
              
                  const tx: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount
                  }
        
                  await wallet.sendTransactionNonBlocking(tx)
                  const toBalanceAfter = await provider.getBalance(testAccount.address)
                  const sent = toBalanceAfter.sub(toBalanceBefore)
                  expect(sent).to.be.eq(ethAmount)
                })
        
                it('Should send two async transactions at once', async () => {
                  const ethAmount1 = ethers.utils.parseEther('1.0')
                  const ethAmount2 = ethers.utils.parseEther('2.0')
                  const ethAmount3 = ethers.utils.parseEther('5.0')
              
                  const tx1: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount1
                  }

                  const tx2: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount2
                  }

                  const tx3: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount3
                  }
        
                  // Just to force deployment
                  const deployWalletTx = {to: ethers.constants.AddressZero}
                  await wallet.sendTransactionNonBlocking(deployWalletTx)
        
                  // Send txns in parallel, but independently
                  await Promise.all([
                    wallet.sendTransactionNonBlocking(tx1),
                    wallet.sendTransactionNonBlocking(tx2),
                    wallet.sendTransactionNonBlocking(tx3)
                  ])
        
                  const toBalanceAfter = await provider.getBalance(testAccount.address)
                  const sent = toBalanceAfter.sub(toBalanceBefore)
                  expect(sent).to.be.eq(ethAmount1.add(ethAmount2).add(ethAmount3))
                })
        
                it('Should send multiple async transactions in one batch, async', async () => {
                  const ethAmount1 = ethers.utils.parseEther('1.0')
                  const ethAmount2 = ethers.utils.parseEther('2.0')
                  const ethAmount3 = ethers.utils.parseEther('5.0')

                  const tx1: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount1
                  }

                  const tx2: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount2
                  }

                  const tx3: ethers.providers.TransactionRequest = {
                    to: testAccount.address,
                    value: ethAmount3
                  }

                  // Send txns in parallel, but independently
                  await wallet.sendTransactionNonBlocking([tx1, tx2, tx3])

                  const toBalanceAfter = await provider.getBalance(testAccount.address)
                  const sent = toBalanceAfter.sub(toBalanceBefore)
                  expect(sent).to.be.eq(ethAmount1.add(ethAmount2).add(ethAmount3))
                })
              })
            })
          })
        })
      })
    })
  })
})
