
import hardhat from 'hardhat'
import * as chai from 'chai'

import { commons, v1, v2 } from "@0xsequence/core"
import { context } from "@0xsequence/tests"
import { ethers } from 'ethers'
import { SequenceOrchestratorWrapper, Wallet } from '../src/index'
import { Orchestrator, signers as hubsigners } from '@0xsequence/signhub'
import { LocalRelayer } from '@0xsequence/relayer'

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

  it.only('Stub', async () => {
    // v2 wallet
    const signer21 = '0x4E98190Ab2713BEE2FD6d63e861f5de5944E0da0'
    const signer22 = '0xB1f69536D293EE3764cE9881894A68029666a851'

    const context2 = {
      version: 2,
      factory: '0x0D7604Bdf2cAcc2943b6388e1c26c3C33213f673',
      mainModule: '0xA507eF52f3fd34dd54566bf3055fA66bdabE2ef3',
      mainModuleUpgradable: '0x13Cc7b579e1acfDc8aD1F9996dd38ff744818a34',
      guestModule: '0xCcB6cA914c20fAde6F2be5827eE40d899076ac2A',
      walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
    }

    const config2: v2.config.WalletConfig = {
      version: 2,
      threshold: 1,
      checkpoint: 0,
      tree: {
        left: {
          address: signer21,
          weight: 1
        },
        right: {
          address: signer22,
          weight: 1
        }
      }
    }

    const treeRoot = v2.config.hashNode(config2.tree)
    const imageHash2 = v2.config.imageHash(config2)
    const address2 = commons.context.addressOf(context2, imageHash2)

    console.log('treeRoot2', treeRoot)
    console.log('imageHash2', imageHash2)
    console.log('address2', address2)

    // v1 wallet
    const signer11 = '0x39379dB0a039250334B348923B8003B633d3Ef3C'
    const signer12 = '0xC50AdEadB7fe15Bee45DCb820610CdeDCD314EB0'

    const context1 = {
      version: 1,
      factory: '0xf9D09D634Fb818b05149329C1dcCFAeA53639d96',
      mainModule: '0xd01F11855bCcb95f88D7A48492F66410d4637313',
      mainModuleUpgradable: '0x7EFE6cE415956c5f80C6530cC6cc81b4808F6118',
      guestModule: '0x02390F3E6E5FD1C6786CB78FD3027C117a9955A7',
      walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
    }

    const config1: v1.config.WalletConfig = {
      version: 1,
      threshold: 1,
      signers: [{
        address: signer11,
        weight: 1
      }, {
        address: signer12,
        weight: 1
      }]
    }

    const imageHash1 = v1.config.ConfigCoder.imageHashOf(config1)
    const address1 = commons.context.addressOf(context1, imageHash1)

    console.log('imageHash1', imageHash1)
    console.log('address1', address1)
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
            })
          })
        })
      })
    })
  })
})
