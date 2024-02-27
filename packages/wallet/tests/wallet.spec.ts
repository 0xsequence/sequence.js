import hardhat from 'hardhat'
import * as chai from 'chai'

import { walletContracts } from '@0xsequence/abi'
import { commons, v1, v2 } from '@0xsequence/core'
import { context } from '@0xsequence/tests'
import { ethers } from 'ethers'
import { SequenceOrchestratorWrapper, Wallet } from '../src/index'
import { Orchestrator, SignatureOrchestrator, signers as hubsigners } from '@0xsequence/signhub'
import { LocalRelayer } from '@0xsequence/relayer'

const { expect } = chai

type Coders = {
  signature: commons.signature.SignatureCoder<any, any, any>
  config: commons.config.ConfigCoder<any>
}

describe('Wallet (primitive)', () => {
  let provider: ethers.providers.JsonRpcProvider
  let signers: ethers.Signer[]

  let contexts: Awaited<ReturnType<typeof context.deploySequenceContexts>>
  let relayer: LocalRelayer

  before(async () => {
    provider = new ethers.providers.Web3Provider(hardhat.network.provider as any)
    signers = new Array(8).fill(0).map((_, i) => provider.getSigner(i))
    contexts = await context.deploySequenceContexts(signers[0])
    relayer = new LocalRelayer(signers[0])
  })
  ;(
    [
      {
        version: 1,
        coders: { signature: v1.signature.SignatureCoder, config: v1.config.ConfigCoder }
      },
      {
        version: 2,
        coders: { signature: v2.signature.SignatureCoder, config: v2.config.ConfigCoder }
      }
    ] as { version: number; coders: Coders }[]
  ).map(({ version, coders }) => {
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
      })

      it('Should deploy children', async () => {
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
        const config = coders.config.fromSimple({
          threshold: 1,
          checkpoint: 0,
          signers: [{ address: nestedWallet.address, weight: 1 }]
        })
        const orchestrator = new Orchestrator([new SequenceOrchestratorWrapper(nestedWallet)])
        const wallet = Wallet.newWallet({
          coders: coders,
          context: contexts[version],
          config,
          orchestrator,
          chainId: provider.network.chainId,
          provider,
          relayer
        })

        expect(await wallet.reader().isDeployed(wallet.address)).to.be.false
        expect(await nestedWallet.reader().isDeployed(nestedWallet.address)).to.be.false
        await wallet.deploy({ includeChildren: true, ignoreDeployed: true })
        expect(await wallet.reader().isDeployed(wallet.address)).to.be.true
        expect(await nestedWallet.reader().isDeployed(wallet.address)).to.be.true
      })

      describe('Nonce selection', async () => {
        let signer: ethers.Wallet
        let wallet: Wallet

        let getNonce: (response: ethers.providers.TransactionResponse) => { space: ethers.BigNumber; nonce: ethers.BigNumber }

        before(async () => {
          const mainModule = new ethers.utils.Interface(walletContracts.mainModule.abi)

          getNonce = ({ data }) => {
            const [_, encoded] = mainModule.decodeFunctionData('execute', data)
            const [space, nonce] = commons.transaction.decodeNonce(encoded)
            return { space, nonce }
          }

          signer = ethers.Wallet.createRandom()

          wallet = Wallet.newWallet({
            coders,
            context: contexts[version],
            config: coders.config.fromSimple({
              threshold: 1,
              checkpoint: 0,
              signers: [{ weight: 1, address: signer.address }]
            }),
            chainId: provider.network.chainId,
            orchestrator: new Orchestrator([signer]),
            provider,
            relayer
          })

          await wallet.deploy({ includeChildren: true, ignoreDeployed: true })

          await (await signers[0].sendTransaction({ to: wallet.address, value: ethers.utils.parseEther('1') })).wait()
        })

        it('Should use explicitly set nonces', async () => {
          let response = await wallet.sendTransaction(
            { to: signers[0].getAddress(), value: 1 },
            { nonce: commons.transaction.encodeNonce(6492, 0) }
          )

          let { space, nonce } = getNonce(response)

          expect(space.eq(6492)).to.be.true
          expect(nonce.eq(0)).to.be.true

          await response.wait()

          response = await wallet.sendTransaction(
            { to: signers[0].getAddress(), value: 1 },
            { nonce: commons.transaction.encodeNonce(6492, 1) }
          )

          const encoded = getNonce(response)
          space = encoded.space
          nonce = encoded.nonce

          expect(space.eq(6492)).to.be.true
          expect(nonce.eq(1)).to.be.true
        })

        it('Should select random nonces by default', async () => {
          let response = await wallet.sendTransaction({ to: signers[0].getAddress(), value: 1 })

          const { space: firstSpace, nonce: firstNonce } = getNonce(response)

          expect(firstSpace.eq(0)).to.be.false
          expect(firstNonce.eq(0)).to.be.true

          // not necessary, parallel execution is ok:
          // await response.wait()

          response = await wallet.sendTransaction({ to: signers[0].getAddress(), value: 1 })

          const { space: secondSpace, nonce: secondNonce } = getNonce(response)

          expect(secondSpace.eq(0)).to.be.false
          expect(secondNonce.eq(0)).to.be.true

          expect(secondSpace.eq(firstSpace)).to.be.false
        })

        it('Should respect the serial option', async () => {
          let response = await wallet.sendTransaction({ to: signers[0].getAddress(), value: 1 }, { serial: true })

          let { space, nonce } = getNonce(response)

          expect(space.eq(0)).to.be.true
          expect(nonce.eq(0)).to.be.true

          await response.wait()

          response = await wallet.sendTransaction({ to: signers[0].getAddress(), value: 1 }, { serial: true })

          const encoded = getNonce(response)
          space = encoded.space
          nonce = encoded.nonce

          expect(space.eq(0)).to.be.true
          expect(nonce.eq(1)).to.be.true
        })
      })

      //
      // Run tests using different combinations of signers
      //
      ;[
        {
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
        },
        {
          name: '1/2 signers',
          signers: () => {
            const signer = ethers.Wallet.createRandom()
            const signers = [
              {
                address: signer.address,
                weight: 1
              },
              {
                address: ethers.Wallet.createRandom().address,
                weight: 1
              }
            ].sort(() => (Math.random() > 0.5 ? 1 : -1))

            const config = coders.config.fromSimple({
              threshold: 1,
              checkpoint: 0,
              signers
            })

            const orchestrator = new Orchestrator([new hubsigners.SignerWrapper(signer)])
            return { config, orchestrator }
          }
        },
        {
          name: '2/4 signers',
          signers: () => {
            const members = new Array(4).fill(0).map(() => ethers.Wallet.createRandom())

            const signers = members
              .map(m => ({
                address: m.address,
                weight: 2
              }))
              .sort(() => (Math.random() > 0.5 ? 1 : -1))

            const config = coders.config.fromSimple({
              threshold: 2,
              checkpoint: 0,
              signers
            })

            const orchestrator = new Orchestrator(members.slice(0, 2).map(m => new hubsigners.SignerWrapper(m)))
            return { config, orchestrator }
          }
        },
        {
          name: '11/90 signers',
          signers: () => {
            const members = new Array(90).fill(0).map(() => ethers.Wallet.createRandom())

            const signers = members
              .map(m => ({
                address: m.address,
                weight: 1
              }))
              .sort(() => (Math.random() > 0.5 ? 1 : -1))

            const config = coders.config.fromSimple({
              threshold: 11,
              checkpoint: 0,
              signers
            })

            const orchestrator = new Orchestrator(members.slice(0, 11).map(m => new hubsigners.SignerWrapper(m)))
            return { config, orchestrator }
          }
        },
        {
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
        },
        {
          name: '1/1 signer (undeployed nested)',
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

            expect(await nestedWallet.reader().isDeployed(nestedWallet.address)).to.be.false

            const config = coders.config.fromSimple({
              threshold: 1,
              checkpoint: 0,
              signers: [{ address: nestedWallet.address, weight: 1 }]
            })

            const orchestrator = new Orchestrator([new SequenceOrchestratorWrapper(nestedWallet)])

            return { config, orchestrator }
          }
        }
      ].map(({ name, signers }) => {
        describe(`Using ${name}`, () => {
          let orchestrator: SignatureOrchestrator
          let config: commons.config.Config

          beforeEach(async () => {
            const { config: _config, orchestrator: _orchestrator } = await signers()
            config = _config
            orchestrator = _orchestrator
          })

          // Skip this as we cannot validate a message with an undeployed nested wallet
          if (name !== '1/1 signer (undeployed nested)') {
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
            })
          }

          //
          // Run tests for deployed and undeployed wallets
          // transactions should be decorated automatically
          //
          ;[
            {
              name: 'After deployment',
              setup: async (wallet: Wallet) => {
                await wallet.deploy()
              },
              deployed: true
            },
            {
              name: 'Before deployment',
              setup: async (_: Wallet) => {},
              deployed: false
            }
          ].map(({ name, setup, deployed }) => {
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
                await wallet.sendTransaction([
                  {
                    to: ethers.Wallet.createRandom().address
                  }
                ])
              })

              it('Should build and execute a wallet update transaction', async () => {
                const newConfig = coders.config.fromSimple({
                  threshold: 1,
                  checkpoint: 0,
                  signers: [
                    {
                      address: ethers.Wallet.createRandom().address,
                      weight: 1
                    }
                  ]
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

              describe('parallel transactions', async () => {
                let testAccount: ethers.providers.JsonRpcSigner
                let testAccountAddress: string
                let toBalanceBefore: ethers.BigNumber

                beforeEach(async () => {
                  testAccount = provider.getSigner(5)
                  testAccountAddress = await testAccount.getAddress()

                  const ethAmount = ethers.utils.parseEther('100')
                  const txResp = await testAccount.sendTransaction({
                    to: await wallet.getAddress(),
                    value: ethAmount
                  })
                  await provider.getTransactionReceipt(txResp.hash)
                  toBalanceBefore = await provider.getBalance(testAccountAddress)
                })

                it('Should send an async transaction', async () => {
                  const ethAmount = ethers.utils.parseEther('1.0')

                  const tx: ethers.providers.TransactionRequest = {
                    to: testAccountAddress,
                    value: ethAmount
                  }

                  await wallet.sendTransaction(tx)
                  const toBalanceAfter = await provider.getBalance(testAccountAddress)
                  const sent = toBalanceAfter.sub(toBalanceBefore)
                  expect(sent.toString()).to.be.eq(ethAmount.toString())
                })

                it('Should send two async transactions at once', async () => {
                  const ethAmount1 = ethers.utils.parseEther('1.0')
                  const ethAmount2 = ethers.utils.parseEther('2.0')
                  const ethAmount3 = ethers.utils.parseEther('5.0')

                  const tx1: ethers.providers.TransactionRequest = {
                    to: testAccountAddress,
                    value: ethAmount1
                  }

                  const tx2: ethers.providers.TransactionRequest = {
                    to: testAccountAddress,
                    value: ethAmount2
                  }

                  const tx3: ethers.providers.TransactionRequest = {
                    to: testAccountAddress,
                    value: ethAmount3
                  }

                  // Send txns in parallel, but independently
                  await Promise.all([wallet.sendTransaction(tx1), wallet.sendTransaction(tx2), wallet.sendTransaction(tx3)])

                  const toBalanceAfter = await provider.getBalance(testAccountAddress)
                  const sent = toBalanceAfter.sub(toBalanceBefore)
                  expect(sent.toString()).to.be.eq(ethAmount1.add(ethAmount2).add(ethAmount3).toString())
                })

                it('Should send multiple async transactions in one batch, async', async () => {
                  const ethAmount1 = ethers.utils.parseEther('1.0')
                  const ethAmount2 = ethers.utils.parseEther('2.0')
                  const ethAmount3 = ethers.utils.parseEther('5.0')

                  const tx1: ethers.providers.TransactionRequest = {
                    to: testAccountAddress,
                    value: ethAmount1
                  }

                  const tx2: ethers.providers.TransactionRequest = {
                    to: testAccountAddress,
                    value: ethAmount2
                  }

                  const tx3: ethers.providers.TransactionRequest = {
                    to: testAccountAddress,
                    value: ethAmount3
                  }

                  // Send txns in parallel, but independently
                  await wallet.sendTransaction([tx1, tx2, tx3])

                  const toBalanceAfter = await provider.getBalance(testAccountAddress)
                  const sent = toBalanceAfter.sub(toBalanceBefore)
                  expect(sent.toString()).to.be.eq(ethAmount1.add(ethAmount2).add(ethAmount3).toString())
                })
              })
            })
          })
        })
      })
    })
  })
})
