import { commons, v1, v2 } from '@0xsequence/core'
import { migrator } from '@0xsequence/migration'
import { NetworkConfig } from '@0xsequence/network'
import { FeeOption, FeeQuote, LocalRelayer, LocalRelayerOptions, Relayer, proto } from '@0xsequence/relayer'
import { tracker, trackers } from '@0xsequence/sessions'
import { Orchestrator } from '@0xsequence/signhub'
import * as utils from '@0xsequence/tests'
import { Wallet } from '@0xsequence/wallet'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ethers } from 'ethers'
import hardhat from 'hardhat'

import { Account } from '../src/account'
import { now, randomWallet } from './account.spec'
import { createERC20 } from '@0xsequence/tests/src/tokens/erc20'

const { expect } = chai.use(chaiAsPromised)

describe('Account signer', () => {
  let provider1: ethers.providers.JsonRpcProvider
  let provider2: ethers.providers.JsonRpcProvider

  let signer1: ethers.Signer
  let signer2: ethers.Signer

  let contexts: commons.context.VersionedContext
  let networks: NetworkConfig[]

  let tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker

  let defaultArgs: {
    contexts: commons.context.VersionedContext
    networks: NetworkConfig[]
    tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
  }

  before(async () => {
    provider1 = new ethers.providers.Web3Provider(hardhat.network.provider.send)
    provider2 = new ethers.providers.JsonRpcProvider('http://127.0.0.1:7048')

    // TODO: Implement migrations on local config tracker
    tracker = new trackers.local.LocalConfigTracker(provider1) as any

    networks = [
      {
        chainId: 31337,
        name: 'hardhat',
        provider: provider1,
        rpcUrl: '',
        relayer: new LocalRelayer(provider1.getSigner())
      },
      {
        chainId: 31338,
        name: 'hardhat2',
        provider: provider2,
        rpcUrl: 'http://127.0.0.1:7048',
        relayer: new LocalRelayer(provider2.getSigner())
      }
    ]

    signer1 = provider1.getSigner()
    signer2 = provider2.getSigner()

    contexts = await utils.context.deploySequenceContexts(signer1)
    const context2 = await utils.context.deploySequenceContexts(signer2)

    expect(contexts).to.deep.equal(context2)

    defaultArgs = {
      contexts,
      networks,
      tracker
    }
  })

  describe('with new account', () => {
    var account: Account
    var config: any
    var accountSigner: ethers.Wallet

    beforeEach(async () => {
      accountSigner = randomWallet('Should create a new account')
      config = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: accountSigner.address, weight: 1 }]
      }

      account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([accountSigner])
      })
    })

    ;([
      31337,
      31338
    ]).map((chainId: number) => {
      context(`for chain ${chainId}`, () => {
        it('should send transaction', async () => {
          const signer = account.getSigner(chainId)

          const res = await signer.sendTransaction({
            to: ethers.Wallet.createRandom().address,
          })
    
          expect(res).to.exist
          expect(res.hash).to.exist
    
          expect(await signer.provider.getTransaction(res.hash)).to.exist
        })

        it('should send batch transaction', async () => {
          const signer = account.getSigner(chainId)

          const res = await signer.sendTransaction([
            {
              to: ethers.Wallet.createRandom().address,
            },
            {
              to: ethers.Wallet.createRandom().address,
            },
          ])
    
          expect(res).to.exist
          expect(res.hash).to.exist
    
          expect(await signer.provider.getTransaction(res.hash)).to.exist
        })

        it('should send two transactions (one has deploy)', async () => {
          const signer = account.getSigner(chainId)

          expect(await signer.provider.getCode(account.address)).to.equal('0x')

          await signer.sendTransaction({
            to: ethers.Wallet.createRandom().address,
          })

          expect(await signer.provider.getCode(account.address)).to.not.equal('0x')

          const res = await signer.sendTransaction({
            to: ethers.Wallet.createRandom().address,
          })

          expect(res).to.exist
          expect(res.hash).to.exist

          expect(await signer.provider.getTransaction(res.hash)).to.exist
        })

        it('should fail to sign message because not deployed', async () => {
          const signer = account.getSigner(chainId)

          await expect(signer.signMessage(ethers.utils.randomBytes(32)))
            .to.be.rejectedWith('Wallet cannot validate onchain')
        })

        it('should sign message after deployment', async () => {
          const signer = account.getSigner(chainId)

          await signer.sendTransaction({
            to: ethers.Wallet.createRandom().address,
          })

          expect(await signer.provider.getCode(account.address)).to.not.equal('0x')

          const signature = await signer.signMessage(ethers.utils.randomBytes(32))
          expect(signature).to.exist
          expect(signature).to.not.equal('0x')
        })

        it('should sign a message (undeployed) when using EIP6492', async () => {
          const signer = account.getSigner(chainId, { cantValidateBehavior: 'eip6492' })

          const signature = await signer.signMessage(ethers.utils.randomBytes(32))
          expect(signature).to.exist
          expect(signature).to.not.equal('0x')
        })

        it('should return account address', async () => {
          expect(account.address).to.equal(await account.getSigner(chainId).getAddress())
        })

        it('should return chainId', async () => {
          expect(chainId).to.equal(await account.getSigner(chainId).getChainId()) 
        })

        it('should call select fee even if there is no fee', async () => {
          let callsToSelectFee = 0

          const tx = {
            to: ethers.Wallet.createRandom().address,
          }

          const signer = account.getSigner(chainId, {
            selectFee: async (txs: any, options: FeeOption[]) => {
              callsToSelectFee++
              expect(txs).to.deep.equal(tx)
              expect(options).to.deep.equal([])
              return undefined
            }
          })

          const res = await signer.sendTransaction(tx)

          expect(callsToSelectFee).to.equal(1)

          expect(res).to.exist
          expect(res.hash).to.exist

          expect(await signer.provider.getTransaction(res.hash)).to.exist
        })

        describe('select fee', () => {
          var account: never
          var getAccount: (feeOptions: FeeOption[], feeQuote: FeeQuote) => Promise<Account>

          beforeEach(async () => {
            class LocalRelayerWithFee extends LocalRelayer {
              constructor(
                options: LocalRelayerOptions | ethers.Signer,
                public feeOptions: FeeOption[],
                public quote: FeeQuote
              ) {
                super(options)
              }

              async getFeeOptions(
                _address: string,
                ..._transactions: commons.transaction.Transaction[]
              ): Promise<{ options: FeeOption[] }> {
                return { options: this.feeOptions, quote: this.quote } as any
              }

              async getFeeOptionsRaw(
                _entrypoint: string, _data: ethers.utils.BytesLike
              ): Promise<{ options: FeeOption[] }> {
                return { options: this.feeOptions, quote: this.quote } as any
              }

              async gasRefundOptions(
                _address: string,
                ..._transactions: commons.transaction.Transaction[]
              ): Promise<FeeOption[]> {
                return this.feeOptions
              }

              async relay(
                signedTxs: commons.transaction.IntendedTransactionBundle,
                quote?: FeeQuote | undefined,
                waitForReceipt?: boolean | undefined
              ): Promise<commons.transaction.TransactionResponse<ethers.providers.TransactionReceipt>> {
                expect(quote).to.equal(this.quote)
                return super.relay(signedTxs, quote, waitForReceipt)
              }
            }

            getAccount = async (feeOptions: FeeOption[], feeQuote: FeeQuote) => {
              return Account.new({
                ...defaultArgs,
                networks: defaultArgs.networks.map((n) => {
                  return {
                    ...n,
                    relayer: new LocalRelayerWithFee(
                      chainId === 31337 ? signer1 : signer2,
                      feeOptions,
                      feeQuote
                    )
                  }
                }),
                config,
                orchestrator: new Orchestrator([accountSigner])
              })
            }
          })

          it('should automatically select native fee', async () => {
            const feeOptions: FeeOption[] = [{
              token: {
                chainId,
                name: 'native',
                symbol: 'ETH',
                type: proto.FeeTokenType.UNKNOWN,
                logoURL: ''
              },
              to: ethers.Wallet.createRandom().address,
              value: '12',
              gasLimit: 100000
            }]

            const feeQuote: FeeQuote = {
              _tag: 'FeeQuote',
              _quote: ethers.utils.randomBytes(99)
            }

            const account = await getAccount(feeOptions, feeQuote)
            const signer = account.getSigner(chainId)

            await (chainId === 31337 ? signer1 : signer2).sendTransaction({
              to: account.address,
              value: 12
            })

            const res = await signer.sendTransaction({
              to: ethers.Wallet.createRandom().address,
            })

            expect(res).to.exist
            expect(res.hash).to.exist

            expect(await signer.provider.getTransaction(res.hash)).to.exist
          })

          it('should reject if balance is not enough', async () => {
            const feeOptions: FeeOption[] = [{
              token: {
                chainId,
                name: 'native',
                symbol: 'ETH',
                type: proto.FeeTokenType.UNKNOWN,
                logoURL: ''
              },
              to: ethers.Wallet.createRandom().address,
              value: ethers.utils.parseEther('12').toString(),
              gasLimit: 100000
            }]

            const feeQuote: FeeQuote = {
              _tag: 'FeeQuote',
              _quote: ethers.utils.randomBytes(99)
            }

            const account = await getAccount(feeOptions, feeQuote)
            const signer = account.getSigner(chainId)

            await (chainId === 31337 ? signer1 : signer2).sendTransaction({
              to: account.address,
              value: 11
            })

            const res = signer.sendTransaction({
              to: ethers.Wallet.createRandom().address,
            })

            expect(res).to.be.rejectedWith('No fee option available - not enough balance')
          })

          it('should automatically select ERC20 fee', async () => {
            const token = await createERC20(
              (chainId === 31337 ? signer1 : signer2),
              "Test Token",
              "TEST",
              18
            )

            const recipient = ethers.Wallet.createRandom().address
            const feeOptions: FeeOption[] = [{
              token: {
                chainId,
                name: 'TEST',
                symbol: 'TEST',
                type: proto.FeeTokenType.ERC20_TOKEN,
                logoURL: '',
                contractAddress: token.address
              },
              to: recipient,
              value: ethers.utils.parseEther('250').toString(),
              gasLimit: 400000
            }]

            const feeQuote: FeeQuote = {
              _tag: 'FeeQuote',
              _quote: ethers.utils.randomBytes(99)
            }

            const account = await getAccount(feeOptions, feeQuote)
            const signer = account.getSigner(chainId)

            await token.mint(account.address, ethers.utils.parseEther('6000'))

            const res = await signer.sendTransaction({
              to: ethers.Wallet.createRandom().address,
            })

            expect(res).to.exist
            expect(res.hash).to.exist

            expect(await signer.provider.getTransaction(res.hash)).to.exist
            expect(await token.balanceOf(recipient)).to.deep.equal(ethers.utils.parseEther('250'))
          })

          it('should reject ERC20 fee if not enough balance', async () => {
            const token = await createERC20(
              (chainId === 31337 ? signer1 : signer2),
              "Test Token",
              "TEST",
              18
            )

            const recipient = ethers.Wallet.createRandom().address
            const feeOptions: FeeOption[] = [{
              token: {
                chainId,
                name: 'TEST',
                symbol: 'TEST',
                type: proto.FeeTokenType.ERC20_TOKEN,
                logoURL: '',
                contractAddress: token.address
              },
              to: recipient,
              value: ethers.utils.parseEther('250').toString(),
              gasLimit: 400000
            }]

            const feeQuote: FeeQuote = {
              _tag: 'FeeQuote',
              _quote: ethers.utils.randomBytes(99)
            }

            const account = await getAccount(feeOptions, feeQuote)
            const signer = account.getSigner(chainId)

            const res = signer.sendTransaction({
              to: ethers.Wallet.createRandom().address,
            })

            expect(res).to.be.rejectedWith('No fee option available - not enough balance')
          })

          it('should automatically select ERC20 fee if user has no ETH', async () => {
            const token = await createERC20(
              (chainId === 31337 ? signer1 : signer2),
              "Test Token",
              "TEST",
              18
            )

            const recipient = ethers.Wallet.createRandom().address
            const feeOptions: FeeOption[] = [{
              token: {
                chainId,
                name: 'native',
                symbol: 'ETH',
                type: proto.FeeTokenType.UNKNOWN,
                logoURL: ''
              },
              to: recipient,
              value: ethers.utils.parseEther('12').toString(),
              gasLimit: 100000
            }, {
              token: {
                chainId,
                name: 'TEST',
                symbol: 'TEST',
                type: proto.FeeTokenType.ERC20_TOKEN,
                logoURL: '',
                contractAddress: token.address
              },
              to: recipient,
              value: ethers.utils.parseEther('11').toString(),
              gasLimit: 400000
            }]

            const feeQuote: FeeQuote = {
              _tag: 'FeeQuote',
              _quote: ethers.utils.randomBytes(99)
            }

            const account = await getAccount(feeOptions, feeQuote)
            const signer = account.getSigner(chainId)

            await token.mint(account.address, ethers.utils.parseEther('11'))

            const res = await signer.sendTransaction({
              to: ethers.Wallet.createRandom().address,
            })

            expect(res).to.exist
            expect(res.hash).to.exist

            expect(await signer.provider.getTransaction(res.hash)).to.exist
            expect(await token.balanceOf(recipient)).to.deep.equal(ethers.utils.parseEther('11'))
          })

          it('should select fee using callback (first option)', async () => {
            const recipient = ethers.Wallet.createRandom().address

            const token = await createERC20(
              (chainId === 31337 ? signer1 : signer2),
              "Test Token",
              "TEST",
              18
            )

            const feeOptions: FeeOption[] = [{
              token: {
                chainId,
                name: 'native',
                symbol: 'ETH',
                type: proto.FeeTokenType.UNKNOWN,
                logoURL: ''
              },
              to: recipient,
              value: '5',
              gasLimit: 100000
            }, {
              token: {
                chainId,
                name: 'TEST',
                symbol: 'TEST',
                type: proto.FeeTokenType.ERC20_TOKEN,
                logoURL: '',
                contractAddress: token.address
              },
              to: recipient,
              value: ethers.utils.parseEther('11').toString(),
              gasLimit: 400000
            }]

            const feeQuote: FeeQuote = {
              _tag: 'FeeQuote',
              _quote: ethers.utils.randomBytes(99)
            }

            const account = await getAccount(feeOptions, feeQuote)
            const signer = account.getSigner(chainId, {
              selectFee: async (_txs: any, options: FeeOption[]) => {
                expect(options).to.deep.equal(feeOptions)
                return options[0]
              }
            })

            await (chainId === 31337 ? signer1 : signer2).sendTransaction({
              to: account.address,
              value: 5
            })

            const res = await signer.sendTransaction({
              to: ethers.Wallet.createRandom().address,
            })

            expect(res).to.exist
            expect(res.hash).to.exist

            expect(await signer.provider.getTransaction(res.hash)).to.exist
            expect(await signer.provider.getBalance(recipient)).to.deep.equal(ethers.BigNumber.from('5'))
            expect(await token.balanceOf(recipient)).to.deep.equal(ethers.utils.parseEther('0'))
          })

          it('should select fee using callback (second option)', async () => {
            const recipient = ethers.Wallet.createRandom().address

            const token = await createERC20(
              (chainId === 31337 ? signer1 : signer2),
              "Test Token",
              "TEST",
              18
            )

            const feeOptions: FeeOption[] = [{
              token: {
                chainId,
                name: 'native',
                symbol: 'ETH',
                type: proto.FeeTokenType.UNKNOWN,
                logoURL: ''
              },
              to: recipient,
              value: '5',
              gasLimit: 100000
            }, {
              token: {
                chainId,
                name: 'TEST',
                symbol: 'TEST',
                type: proto.FeeTokenType.ERC20_TOKEN,
                logoURL: '',
                contractAddress: token.address
              },
              to: recipient,
              value: ethers.utils.parseEther('11').toString(),
              gasLimit: 400000
            }]

            const feeQuote: FeeQuote = {
              _tag: 'FeeQuote',
              _quote: ethers.utils.randomBytes(99)
            }

            const account = await getAccount(feeOptions, feeQuote)
            const signer = account.getSigner(chainId, {
              selectFee: async (_txs: any, options: FeeOption[]) => {
                expect(options).to.deep.equal(feeOptions)
                return options[1]
              }
            })

            await token.mint(account.address, ethers.utils.parseEther('11'))

            const res = await signer.sendTransaction({
              to: ethers.Wallet.createRandom().address,
            })

            expect(res).to.exist
            expect(res.hash).to.exist

            expect(await signer.provider.getTransaction(res.hash)).to.exist
            expect(await signer.provider.getBalance(recipient)).to.deep.equal(ethers.BigNumber.from('0'))
            expect(await token.balanceOf(recipient)).to.deep.equal(ethers.utils.parseEther('11'))
          })
        })
      })
    })
  })
})
