import { deployWalletContext } from './utils/deploy-wallet-context'
import { encodeData } from './utils'
import { Proof } from '@0xsequence/ethauth'

import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'

import {
  toSequenceTransaction,
  toSequenceTransactions,
  encodeNonce,
  Transactionish,
  isSignedTransactions
} from '@0xsequence/transactions'

import { LocalRelayer } from '@0xsequence/relayer'

import { WalletContext, NetworkConfig } from '@0xsequence/network'
import { ExternalProvider, Web3Provider, JsonRpcProvider } from '@ethersproject/providers'
import { Contract, ethers, Signer as AbstractSigner } from 'ethers'

import { addressOf, joinSignatures, encodeSignature, imageHash, WalletConfig } from '@0xsequence/config'

import { configureLogger, encodeTypedDataDigest } from '@0xsequence/utils'

import * as lib from '../src'

import {
  isValidSignature,
  isValidEthSignSignature,
  isValidSequenceUndeployedWalletSignature,
  fetchImageHash,
  isValidContractWalletSignature,
  RemoteSigner
} from '../src'

import { LocalWeb3Provider, prefixEIP191Message } from '../../provider/src'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

const MainModuleArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModule.sol/MainModule.json')
const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const HookCallerMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/HookCallerMock.sol/HookCallerMock.json')

const Web3 = require('web3')
const { expect } = chai.use(chaiAsPromised)

configureLogger({ logLevel: 'DEBUG', silence: false })

import hardhat from 'hardhat'
import { BytesLike, Interface } from 'ethers/lib/utils'
import { walletContracts } from '@0xsequence/abi'

type EthereumInstance = {
  chainId?: number
  provider?: JsonRpcProvider
  signer?: AbstractSigner
}

describe('Wallet integration', function () {
  const ethnode: EthereumInstance = {}

  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock
  let hookCaller: HookCallerMock

  let context: WalletContext
  let networks: NetworkConfig[]
  let wallet: lib.Wallet

  before(async () => {
    // Provider from hardhat without a server instance
    ethnode.provider = new ethers.providers.Web3Provider(hardhat.network.provider.send)

    // NOTE: if you'd like to test with ganache or hardhat in server mode, just uncomment the line below
    // and make sure your ganache or hardhat instance is running separately
    // NOTE2: ganache will fail at getStorageAt(), as hardhat and ganache treat it a bit differently,
    // which is strange. Hardhat is at fault here IMHO.
    // ethnode.provider = new ethers.providers.JsonRpcProvider(`http://localhost:8545/`)

    ethnode.signer = ethnode.provider.getSigner()
    ethnode.chainId = 31337

    networks = [
      {
        name: 'local',
        chainId: ethnode.chainId,
        provider: ethnode.provider,
        isDefaultChain: true,
        isAuthChain: true
      }
    ]

    // Deploy Sequence env
    const [factory, mainModule, mainModuleUpgradable, guestModule, sequenceUtils, requireFreshSigner] = await deployWalletContext(
      ethnode.signer
    )

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address,
      mainModuleUpgradable: mainModuleUpgradable.address,
      guestModule: guestModule.address,
      sequenceUtils: sequenceUtils.address,
      libs: {
        requireFreshSigner: requireFreshSigner.address
      }
    }

    // Deploy call receiver mock
    callReceiver = (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      ethnode.signer
    ).deploy()) as CallReceiverMock

    // Deploy hook caller mock
    hookCaller = (await new ethers.ContractFactory(
      HookCallerMockArtifact.abi,
      HookCallerMockArtifact.bytecode,
      ethnode.signer
    ).deploy()) as HookCallerMock

    // Deploy local relayer
    relayer = new LocalRelayer({ signer: ethnode.signer })
  })

  beforeEach(async () => {
    // Create wallet
    const pk = ethers.utils.randomBytes(32)
    wallet = await lib.Wallet.singleOwner(pk, context)
    wallet = wallet.connect(ethnode.provider, relayer)
  })

  after(async () => {
    // if (ethnode.server) {
    //   ethnode.server.close()
    // }
  })

  describe('with ethers.js', () => {
    let w3provider: ExternalProvider
    let provider: Web3Provider

    const options = [
      {
        name: 'sequence-wallet',
        signer: () => wallet,
        prefixMessage: (m: BytesLike) => m
      },
      {
        name: 'ethers-signer',
        signer: () => provider.getSigner(),
        prefixMessage: (m: BytesLike) => prefixEIP191Message(m)
      }
    ]

    beforeEach(async () => {
      provider = new LocalWeb3Provider(wallet)
    })

    it('Should return accounts', async () => {
      const accounts = await provider.listAccounts()
      expect(accounts.length).to.be.equal(1)
      expect(accounts[0]).to.be.equal(wallet.address)
    })

    describe('using sequence signer', () => {
      it('should compute valid signedTypeData digest', async () => {
        const typedData = {
          types: {
            Person: [
              { name: 'name', type: 'string' },
              { name: 'wallet', type: 'address' },
              { name: 'count', type: 'uint8' }
            ]
          },
          primaryType: 'Person' as const,
          domain: {
            name: 'Ether Mail',
            version: '1',
            chainId: 1, //ethnode.chainId,
            verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
          },
          message: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
            count: 4
          }
        }

        const digest = ethers.utils._TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
        expect(digest).to.equal('0x2218fda59750be7bb9e5dfb2b49e4ec000dc2542862c5826f1fe980d6d727e95')

        const digestChk2 = ethers.utils.hexlify(encodeTypedDataDigest(typedData))
        expect(digestChk2).to.equal(digest)
      })

      it('Should sign a typed message', async () => {
        const typedData = {
          types: {
            Person: [
              { name: 'name', type: 'string' },
              { name: 'wallet', type: 'address' },
              { name: 'count', type: 'uint8' }
            ]
          },
          primaryType: 'Person' as const,
          domain: {
            name: 'Ether Mail',
            version: '1',
            chainId: ethnode.chainId,
            verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
          },
          message: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
            count: 4
          }
        }

        const digest = ethers.utils._TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
        expect(digest).to.equal('0x69d3381dfd41c0a9cea56d325bcd482eace26dd2e7b95df398cb6d8edc00290c')

        const sig = await wallet.signTypedData(typedData.domain, typedData.types, typedData.message)

        expect(sig).to.not.be.undefined
        expect(sig).to.not.equal('')

        await relayer.deployWallet(wallet.config, context)
        const call = hookCaller.callERC1271isValidSignatureHash(wallet.address, ethers.utils.arrayify(digest), sig)
        await expect(call).to.be.fulfilled
      })
    })
    describe('Nested wallets', async () => {
      it('Should use wallet as wallet signer', async () => {
        const walletA = (await lib.Wallet.singleOwner(ethers.Wallet.createRandom(), context)).connect(ethnode.provider, relayer)
        const walletB = (await lib.Wallet.singleOwner(walletA, context)).connect(ethnode.provider, relayer)

        // TODO: Bundle deployment with child wallets
        await relayer.deployWallet(walletA.config, walletA.context)

        const contractWithSigner = callReceiver.connect(walletB) as CallReceiverMock

        await contractWithSigner.testCall(412313, '0x12222334')
        expect(await contractWithSigner.lastValB()).to.equal('0x12222334')
      })
    })
    options.forEach(s => {
      describe(`using ${s.name} provider`, () => {
        let signer: AbstractSigner

        beforeEach(async () => {
          signer = s.signer()
        })

        it('Should call contract method', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock

          await contractWithSigner.testCall(412313, '0x11222334')
          expect(await contractWithSigner.lastValB()).to.equal('0x11222334')
        })

        it('Should deploy contract', async () => {
          ;(await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            signer
          ).deploy()) as CallReceiverMock
        })

        it('Should perform multiple transactions', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock

          await contractWithSigner.testCall(412313, '0x11222334')
          await contractWithSigner.testCall(11111, '0x')
        })

        it('Should return transaction count', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock

          expect(await provider.getTransactionCount(wallet.address)).to.equal(0)

          await contractWithSigner.testCall(1, '0x')
          expect(await provider.getTransactionCount(wallet.address)).to.equal(1)

          await contractWithSigner.testCall(2, '0x')
          expect(await provider.getTransactionCount(wallet.address)).to.equal(2)

          await contractWithSigner.testCall(3, '0x')
          expect(await provider.getTransactionCount(wallet.address)).to.equal(3)
        })

        describe('Signing', async () => {
          it('Should sign a message', async () => {
            const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')

            const signature = await signer.signMessage(message)

            // Contract wallet must be deployed before calling ERC1271
            const txn = await relayer.deployWallet(wallet.config, context)

            // const receipt = await provider.getTransactionReceipt(txn.hash)
            // console.log('status?', receipt.status)

            const call = hookCaller.callERC1271isValidSignatureData(wallet.address, s.prefixMessage(message), signature)
            await expect(call).to.be.fulfilled
          })
        })
        describe('Gas limits', async () => {
          it('Should send custom gas-limit', async () => {
            const callReceiver1 = (await new ethers.ContractFactory(
              CallReceiverMockArtifact.abi,
              CallReceiverMockArtifact.bytecode,
              ethnode.signer
            ).deploy()) as CallReceiverMock

            const receiver = new ethers.Contract(callReceiver1.address, CallReceiverMockArtifact.abi, signer)

            const tx = await receiver.functions.testCall(2, '0x030233', {
              gasLimit: ethers.BigNumber.from(1048575)
            })

            expect(tx.data).to.contain('00fffff')
          })

          it('Should estimate gas for transaction with 0 gasLimit and revertOnError false', async () => {
            await new ethers.ContractFactory(MainModuleArtifact.abi, MainModuleArtifact.bytecode, signer).deploy(wallet.address)
          })

          it('Should be able to update the config for a wallet with many signers', async () => {
            // first, we try just two signers

            const signers = wallet.config.signers
            while (signers.length < 2) {
              signers.push({
                address: ethers.Wallet.createRandom().address,
                weight: 1
              })
            }

            const newConfig = {
              threshold: 1,
              signers
            }
            let expectedImageHash = imageHash(newConfig)

            let tx = (await wallet.updateConfig(newConfig, undefined, true))[1]
            let receipt = await tx.wait()
            // console.log(`gas usage: ${receipt.gasUsed.toString()} of ${tx.gasLimit.toString()}`)
            expect(receipt.status).to.equal(1)

            let actualImageHash = await fetchImageHash(wallet)
            expect(actualImageHash).to.equal(expectedImageHash)

            const gasLimit1 = tx.gasLimit

            // next, we try 100 signers

            while (signers.length < 100) {
              signers.push({
                address: ethers.Wallet.createRandom().address,
                weight: 1
              })
            }

            newConfig.signers = signers
            expectedImageHash = imageHash(newConfig)

            tx = (await wallet.updateConfig(newConfig, undefined, true))[1]
            receipt = await tx.wait()
            // console.log(`gas usage: ${receipt.gasUsed.toString()} of ${tx.gasLimit.toString()}`)
            expect(receipt.status).to.equal(1)

            actualImageHash = await fetchImageHash(wallet)
            expect(actualImageHash).to.equal(expectedImageHash)

            const gasLimit2 = tx.gasLimit

            // the second operation should have more gas allocated than the first one
            expect(gasLimit2.gt(gasLimit1)).to.be.true
          })
        })
      })

      describe('batch transactions', async () => {
        it('Should send two transactions at once', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const callReceiver2 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x112233'),
            auxiliary: [
              {
                gas: '121000',
                to: callReceiver2.address,
                value: 0,
                data: await encodeData(callReceiver, 'testCall', 2, '0x445566')
              }
            ]
          }

          await wallet.sendTransaction(transaction)

          expect(await callReceiver1.lastValB()).to.equal('0x112233')
          expect(await callReceiver2.lastValB()).to.equal('0x445566')
        })

        it('Should send two transactions at once, alternate syntax', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const callReceiver2 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transactions = [
            {
              gas: '121000',
              to: callReceiver1.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 1, '0x112233')
            },
            {
              gas: '121000',
              to: callReceiver2.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 2, '0x445566')
            }
          ]

          await wallet.sendTransactionBatch(transactions)

          expect(await callReceiver1.lastValB()).to.equal('0x112233')
          expect(await callReceiver2.lastValB()).to.equal('0x445566')
        })

        it('Should send a single transaction with sendTransaction', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015361')
          }

          await wallet.sendTransaction(transaction)
          expect(await callReceiver1.lastValB()).to.equal('0x015361')
        })

        it('Should send three transactions at once', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const callReceiver2 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const callReceiver3 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x112233'),
            auxiliary: [
              {
                gas: '100000',
                to: callReceiver2.address,
                value: 0,
                data: await encodeData(callReceiver, 'testCall', 2, '0x445566')
              },
              {
                gas: '70000',
                to: callReceiver3.address,
                value: 0,
                data: await encodeData(callReceiver, 'testCall', 2, '0x778899')
              }
            ]
          }

          await wallet.sendTransaction(transaction)

          expect(await callReceiver1.lastValB()).to.equal('0x112233')
          expect(await callReceiver2.lastValB()).to.equal('0x445566')
          expect(await callReceiver3.lastValB()).to.equal('0x778899')
        })

        it('Should send nested transactions', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const callReceiver2 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const callReceiver3 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            from: wallet.address,
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x112233'),
            auxiliary: [
              {
                gas: '100000',
                to: callReceiver2.address,
                value: 0,
                data: await encodeData(callReceiver, 'testCall', 2, '0x445566'),
                auxiliary: [
                  {
                    gas: '70000',
                    to: callReceiver3.address,
                    value: 0,
                    data: await encodeData(callReceiver, 'testCall', 2, '0x778899')
                  }
                ]
              }
            ]
          }

          await wallet.sendTransaction(transaction)

          expect(await callReceiver1.lastValB()).to.equal('0x112233')
          expect(await callReceiver2.lastValB()).to.equal('0x445566')
          expect(await callReceiver3.lastValB()).to.equal('0x778899')
        })
      })

      describe('expirable transactions', async () => {
        it('Should generate and send a non-expired transaction', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015561'),
            expiration: Math.floor(Date.now() / 1000) + 86400 * 90
          }

          await wallet.sendTransaction(transaction)
          expect(await callReceiver1.lastValB()).to.equal('0x015561')
        })
        it('Should generate and fail to send a expired transaction', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015561'),
            expiration: Math.floor(Date.now() / 1000) - 86400 * 90
          }

          const tx = wallet.sendTransaction(transaction)
          await expect(tx).to.be.rejected

          expect(await callReceiver1.lastValB()).to.equal('0x')
        })
        it('Should fail to generate a expired transaction without sequenceUtils', async () => {
          // Create wallet
          const pk = ethers.utils.randomBytes(32)

          const context1 = { ...context }
          context1.sequenceUtils = undefined

          let wallet1 = await lib.Wallet.singleOwner(pk, context1)
          wallet1 = wallet1.connect(ethnode.provider, relayer)

          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015561'),
            expiration: Math.floor(Date.now() / 1000) + 86400 * 90
          }

          const tx = wallet1.sendTransaction(transaction)
          await expect(tx).to.be.rejected
          expect(await callReceiver1.lastValB()).to.equal('0x')
        })
      })

      describe('linked transactions', async () => {
        it('Should send transaction linked to same-wallet space', async () => {
          await wallet.sendTransaction({
            revertOnError: true,
            to: wallet.address,
            value: 0,
            data: '0x',
            nonce: encodeNonce(5, 0)
          })

          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015561'),
            expiration: Math.floor(Date.now() / 1000) + 86400 * 90,
            afterNonce: encodeNonce(5, 1),
            nonce: encodeNonce(6, 0)
          }

          await wallet.sendTransaction(transaction)
          expect(await callReceiver1.lastValB()).to.equal('0x015561')
        })
        it('Should falil to send transaction linked to same-wallet space', async () => {
          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015561'),
            expiration: Math.floor(Date.now() / 1000) + 86400 * 90,
            afterNonce: encodeNonce(5, 1),
            nonce: encodeNonce(6, 0)
          }

          const tx = wallet.sendTransaction(transaction)
          await expect(tx).to.be.rejected
          expect(await callReceiver1.lastValB()).to.equal('0x')
        })
        it('Should send transaction linked to other wallet nonce space', async () => {
          // Create wallet
          const pk = ethers.utils.randomBytes(32)
          let wallet2 = await lib.Wallet.singleOwner(pk, context)
          wallet2 = wallet2.connect(ethnode.provider, relayer)

          await wallet2.sendTransaction({
            revertOnError: true,
            to: wallet.address,
            value: 0,
            data: '0x',
            nonce: encodeNonce(5, 0)
          })

          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015561'),
            expiration: Math.floor(Date.now() / 1000) + 86400 * 90,
            afterNonce: {
              address: wallet2.address,
              nonce: 1,
              space: 5
            }
          }

          await wallet.sendTransaction(transaction)
          expect(await callReceiver1.lastValB()).to.equal('0x015561')
        })
        it('Should fail to send transaction linked to other wallet nonce space', async () => {
          // Create wallet
          const pk = ethers.utils.randomBytes(32)
          let wallet2 = await lib.Wallet.singleOwner(pk, context)
          wallet2 = wallet2.connect(ethnode.provider, relayer)

          const callReceiver1 = (await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            ethnode.signer
          ).deploy()) as CallReceiverMock

          const transaction = {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x015561'),
            expiration: Math.floor(Date.now() / 1000) + 86400 * 90,
            afterNonce: {
              address: wallet2.address,
              nonce: 1,
              space: 5
            }
          }

          const tx = wallet.sendTransaction(transaction)
          await expect(tx).to.be.rejected
          expect(await callReceiver1.lastValB()).to.equal('0x')
        })
      })
    })

    describe('wallet batch transactions', async () => {
      it('Should send two transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const transaction = [
          {
            gasPrice: '20000000000',
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x112233')
          },
          {
            gasPrice: '20000000000',
            gas: '121000',
            to: callReceiver2.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 2, '0x445566')
          }
        ]

        await wallet.sendTransaction(transaction)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
      })

      it('Should send three transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver3 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const transaction = [
          {
            gas: '121000',
            to: callReceiver1.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 1, '0x112233')
          },
          {
            gas: '100000',
            to: callReceiver2.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 2, '0x445566')
          },
          {
            gas: '70000',
            to: callReceiver3.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 2, '0x778899')
          }
        ]

        await wallet.sendTransaction(transaction)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
        expect(await callReceiver3.lastValB()).to.equal('0x778899')
      })
    })
  })

  describe('with web3', () => {
    let provider: ExternalProvider
    let w3: any

    beforeEach(async () => {
      provider = new LocalWeb3Provider(wallet).provider
      w3 = new Web3(provider)
    })

    it('Should return accounts', async () => {
      const accounts = await w3.eth.getAccounts()
      expect(accounts.length).to.be.equal(1)
      expect(accounts[0]).to.be.equal(wallet.address)
    })

    it('Should call contract method', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi, callReceiver.address)

      await contractWithSigner.methods.testCall(412313, '0x11222334').send({ from: wallet.address })
      expect(await contractWithSigner.methods.lastValB().call()).to.equal('0x11222334')
    })

    it('Should deploy contract', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi)
      await contractWithSigner.deploy({
        data: CallReceiverMockArtifact.bytecode
      })
    })

    it('Should perform multiple transactions', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi, callReceiver.address)

      await contractWithSigner.methods.testCall(412313, '0x11222334').send({ from: wallet.address })
      await contractWithSigner.methods.testCall(11111, '0x').send({ from: wallet.address })
    })

    it('Should return transaction count', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi, callReceiver.address)

      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(0)

      await contractWithSigner.methods.testCall(1, '0x').send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(1)

      await contractWithSigner.methods.testCall(2, '0x').send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(2)

      await contractWithSigner.methods.testCall(3, '0x').send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(3)
    })

    describe('signing', async () => {
      it('Should sign transaction', async () => {
        const signed = await w3.eth.signTransaction({
          from: wallet.address,
          gasPrice: '20000000000',
          gasLimit: '121000',
          to: '0x3535353535353535353535353535353535353535',
          value: '1000000000000000000',
          data: '0x9988776655'
        })

        expect(isSignedTransactions(signed)).to.be.true
        expect(signed.config).to.deep.equal(wallet.config)
        expect(signed.context).to.deep.equal(wallet.context)
        expect(signed.signature).to.be.a('string')
        expect(signed.transactions.length).to.equal(1)
        expect(signed.transactions[0].gasLimit).to.equal('121000')
        expect(signed.transactions[0].to).to.equal('0x3535353535353535353535353535353535353535')
        expect(signed.transactions[0].value).to.equal('0xde0b6b3a7640000')
        expect(signed.transactions[0].data).to.equal('0x9988776655')
        expect(signed.transactions[0].delegateCall).to.equal(false)
        expect(signed.transactions[0].revertOnError).to.equal(false)
      })

      it('Should sign a message', async () => {
        const message = 'Hi! this is a test message'

        const signature = await w3.eth.sign(message, wallet.address)

        // Contract wallet must be deployed before calling ERC1271
        await relayer.deployWallet(wallet.config, context)

        const call = hookCaller.callERC1271isValidSignatureData(wallet.address, prefixEIP191Message(message), signature)
        await expect(call).to.be.fulfilled
      })

      it('Should sign and send transaction', async () => {
        const signed = await w3.eth.signTransaction({
          from: wallet.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: callReceiver.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 123, '0x445566')
        })

        const tx = await w3.eth.sendSignedTransaction(signed)
        expect(tx.transactionHash).to.be.a('string')

        expect(await callReceiver.lastValB()).to.equal('0x445566')
      })

      it('Should sign, joinSignatures and send a transaction with decoded signature', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s3 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const config = {
          threshold: 3,
          signers: [
            {
              address: s1.address,
              weight: 1
            },
            {
              address: s2.address,
              weight: 1
            },
            {
              address: s3.address,
              weight: 1
            }
          ]
        }

        const wallet_1 = new lib.Wallet({ config, context }, s1).connect(ethnode.provider, relayer)
        const wallet_2 = new lib.Wallet({ config, context }, s2).connect(ethnode.provider, relayer)
        const wallet_3 = new lib.Wallet({ config, context }, s3).connect(ethnode.provider, relayer)

        expect(wallet_1.address).to.equal(wallet_2.address)
        expect(wallet_2.address).to.equal(wallet_3.address)

        const w3_1 = new Web3(new LocalWeb3Provider(wallet_1))
        const w3_2 = new Web3(new LocalWeb3Provider(wallet_2))
        const w3_3 = new Web3(new LocalWeb3Provider(wallet_3))

        const transaction = {
          from: wallet_1.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: callReceiver.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 123, '0x445566')
        }

        const signed_1 = await w3_1.eth.signTransaction(transaction)
        const signed_2 = await w3_2.eth.signTransaction(transaction)
        const signed_3 = await w3_3.eth.signTransaction(transaction)

        const full_signed = {
          ...signed_1,
          signature: joinSignatures(signed_1.signature, signed_2.signature, signed_3.signature)
        }

        const tx = await w3_1.eth.sendSignedTransaction(full_signed)
        expect(tx.transactionHash).to.be.a('string')

        expect(await callReceiver.lastValB()).to.equal('0x445566')
      })

      it('Should sign, joinSignatures and send a transaction with encoded signature', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s3 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const config = {
          threshold: 3,
          signers: [
            {
              address: s1.address,
              weight: 1
            },
            {
              address: s2.address,
              weight: 1
            },
            {
              address: s3.address,
              weight: 1
            }
          ]
        }

        const wallet_1 = new lib.Wallet({ config, context }, s1).connect(ethnode.provider, relayer)
        const wallet_2 = new lib.Wallet({ config, context }, s2).connect(ethnode.provider, relayer)
        const wallet_3 = new lib.Wallet({ config, context }, s3).connect(ethnode.provider, relayer)

        expect(wallet_1.address).to.equal(wallet_2.address)
        expect(wallet_2.address).to.equal(wallet_3.address)

        const w3_1 = new Web3(new LocalWeb3Provider(wallet_1))
        const w3_2 = new Web3(new LocalWeb3Provider(wallet_2))
        const w3_3 = new Web3(new LocalWeb3Provider(wallet_3))

        const transaction = {
          from: wallet_1.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: callReceiver.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 123, '0x445566')
        }

        const signed_1 = await w3_1.eth.signTransaction(transaction)
        const signed_2 = await w3_2.eth.signTransaction(transaction)
        const signed_3 = await w3_3.eth.signTransaction(transaction)

        const full_signed = {
          ...signed_1,
          signature: encodeSignature(joinSignatures(signed_1.signature, signed_2.signature, signed_3.signature))
        }

        const tx = await w3_1.eth.sendSignedTransaction(full_signed)
        expect(tx.transactionHash).to.be.a('string')

        expect(await callReceiver.lastValB()).to.equal('0x445566')
      })
    })

    describe('estimate gas', async () => {
      it('Should estimate gas for a single meta-tx', async () => {
        await callReceiver.testCall(0, '0x')

        const transaction = {
          from: wallet.address,
          gasPrice: '20000000000',
          gasLimit: 0,
          to: callReceiver.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 123, '0x445566')
        }

        const stx = await toSequenceTransaction(wallet, transaction)
        const results = await relayer.simulate(wallet.address, stx)
        const gasLimits = results.map(result => result.gasLimit)
        expect(gasLimits[0]).to.be.above(60000)
        expect(gasLimits[0]).to.be.below(100000)
      })
      it('Should estimate gas for a single big meta-tx', async () => {
        await callReceiver.testCall(0, '0x')

        const data = ethers.utils.randomBytes(512)
        const transaction = {
          from: wallet.address,
          gasPrice: '20000000000',
          gasLimit: 0,
          to: callReceiver.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 23, data)
        }

        const stx = await toSequenceTransaction(wallet, transaction)
        const results = await relayer.simulate(wallet.address, stx)
        const gasLimits = results.map(result => result.gasLimit)
        expect(gasLimits[0]).to.be.above(390000)
        expect(gasLimits[0]).to.be.below(400000)
      })
      it('Should estimate gas for a batch of meta-txs', async () => {
        await callReceiver.testCall(0, '0x')

        const data = ethers.utils.randomBytes(512)
        const transactions = [
          {
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, data)
          },
          {
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, '0x445566')
          }
        ]

        const stxs = await toSequenceTransactions(wallet, transactions)
        const results = await relayer.simulate(wallet.address, ...stxs)
        const gasLimits = results.map(result => result.gasLimit)
        expect(gasLimits[0]).to.be.above(390000)
        expect(gasLimits[0]).to.be.below(400000)
        expect(gasLimits[1]).to.be.above(60000)
        expect(gasLimits[1]).to.be.below(100000)
      })
    })

    describe('batch transactions', async () => {
      it('Should send two transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const transaction = {
          from: wallet.address,
          gas: '121000',
          to: callReceiver1.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 1, '0x112233'),
          auxiliary: [
            {
              gas: '121000',
              to: callReceiver2.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 2, '0x445566')
            }
          ]
        }

        const signed = await w3.eth.signTransaction(transaction)
        await w3.eth.sendSignedTransaction(signed)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
      })

      it('Should send three transactions at once', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver3 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const transaction = {
          from: wallet.address,
          gas: '121000',
          to: callReceiver1.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 1, '0x112233'),
          auxiliary: [
            {
              gas: '100000',
              to: callReceiver2.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 2, '0x445566')
            },
            {
              gas: '70000',
              to: callReceiver3.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 2, '0x778899')
            }
          ]
        }

        const signed = await w3.eth.signTransaction(transaction)
        await w3.eth.sendSignedTransaction(signed)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
        expect(await callReceiver3.lastValB()).to.equal('0x778899')
      })

      it('Should send nested transactions', async () => {
        const callReceiver1 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver2 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const callReceiver3 = (await new ethers.ContractFactory(
          CallReceiverMockArtifact.abi,
          CallReceiverMockArtifact.bytecode,
          ethnode.signer
        ).deploy()) as CallReceiverMock

        const transaction = {
          from: wallet.address,
          gas: '121000',
          to: callReceiver1.address,
          value: 0,
          data: await encodeData(callReceiver, 'testCall', 1, '0x112233'),
          auxiliary: [
            {
              gas: '100000',
              to: callReceiver2.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 2, '0x445566'),
              auxiliary: [
                {
                  gas: '70000',
                  to: callReceiver3.address,
                  value: 0,
                  data: await encodeData(callReceiver, 'testCall', 2, '0x778899')
                }
              ]
            }
          ]
        }

        const signed = await w3.eth.signTransaction(transaction)
        await w3.eth.sendSignedTransaction(signed)

        expect(await callReceiver1.lastValB()).to.equal('0x112233')
        expect(await callReceiver2.lastValB()).to.equal('0x445566')
        expect(await callReceiver3.lastValB()).to.equal('0x778899')
      })
    })
  })

  describe('Validate signatures', () => {
    const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')
    const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

    describe('ethSign', () => {
      it('Should validate ethSign signature', async () => {
        const signer = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signature = await signer.signMessage(digest)
        expect(await isValidSignature(signer.address, digest, signature)).to.be.true
      })
      it('Should validate ethSign signature using direct method', async () => {
        const signer = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signature = await signer.signMessage(digest)
        expect(isValidEthSignSignature(signer.address, digest, signature)).to.be.true
      })
      it('Should reject invalid ethSign signature using direct method', async () => {
        const signer1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signer2 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const signature = await signer1.signMessage(digest)
        expect(await isValidSignature(signer2.address, digest, signature)).to.be.undefined
      })
    })
    describe('deployed sequence wallet sign', async () => {
      it('Should validate sequence wallet signature', async () => {
        const signature = await wallet.sign(message, false, ethnode.chainId)
        await relayer.deployWallet(wallet.config, context)
        expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider)).to.be.true
      })
      it('Should validate sequence wallet signature using direct method', async () => {
        const signature = await wallet.signMessage(message, ethnode.chainId)
        await relayer.deployWallet(wallet.config, context)
        expect(await isValidContractWalletSignature(wallet.address, digest, signature, ethnode.provider)).to.be.true
      })
      it('Should reject sequence wallet invalid signature', async () => {
        const wallet2 = (await lib.Wallet.singleOwner(new ethers.Wallet(ethers.utils.randomBytes(32)), context)).setProvider(
          ethnode.provider
        )
        const signature = await wallet2.signMessage(message, ethnode.chainId)
        await relayer.deployWallet(wallet.config, context)
        expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider, context)).to.be.false
      })
      it('Should validate sequence wallet signature via signTypedData', async () => {
        // ensure its deployed, as in our test we're assuming we're testing to a deployed wallet
        await relayer.deployWallet(wallet.config, context)

        const typedData = {
          types: {
            Person: [
              { name: 'name', type: 'string' },
              { name: 'wallet', type: 'address' },
              { name: 'count', type: 'uint8' }
            ]
          },
          primaryType: 'Person' as const,
          domain: {
            name: 'Ether Mail',
            version: '1',
            chainId: ethnode.chainId,
            verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
          },
          message: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
            count: 4
          }
        }

        const digest = encodeTypedDataDigest(typedData)
        expect(ethers.utils.hexlify(digest)).to.equal('0x69d3381dfd41c0a9cea56d325bcd482eace26dd2e7b95df398cb6d8edc00290c')

        // an eip712 signed message is just a 712 object's encoded digest, signed as a message.
        // therefore, first we will do so directly
        {
          const signature = await wallet.sign(digest, true, ethnode.chainId)
          expect(await isValidContractWalletSignature(wallet.address, digest, signature, ethnode.provider)).to.be.true
        }

        // second, we use the signTypedData method directly for convenience
        {
          const signature = await wallet.signTypedData(typedData.domain, typedData.types, typedData.message, ethnode.chainId)
          expect(await isValidContractWalletSignature(wallet.address, digest, signature, ethnode.provider)).to.be.true
        }
      })
      describe('After updating the owners', () => {
        let wallet2: lib.Wallet

        beforeEach(async () => {
          const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
          const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

          const newConfig = {
            threshold: 2,
            signers: [
              {
                address: s1.address,
                weight: 1
              },
              {
                address: s2.address,
                weight: 1
              }
            ]
          }

          const [config, tx] = await wallet.updateConfig(newConfig)
          await tx.wait()

          wallet2 = new lib.Wallet({ config, context }, s1, s2).connect(ethnode.provider, relayer)
        })
        it('Should reject previous wallet configuration signature', async () => {
          const signature = await wallet.signMessage(message, ethnode.chainId)
          expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider, context)).to.be.false
        })
        it('Should validate new wallet configuration signature', async () => {
          const signature = await wallet2.signMessage(message, ethnode.chainId)
          expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider, context)).to.be.true
        })
      })
    })
    describe('non-deployed sequence wallet sign', async () => {
      it('Should validate sequence wallet signature', async () => {
        const signature = await wallet.signMessage(message)
        expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider, context)).to.be.true
      })
      it('Should valdiate sequence wallet multi-signature', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 2,
          signers: [
            {
              address: s1.address,
              weight: 1
            },
            {
              address: s2.address,
              weight: 1
            }
          ]
        }

        const wallet2 = new lib.Wallet({ config: newConfig, context }, s1, s2).connect(ethnode.provider, relayer)
        const signature = await wallet2.signMessage(message)
        expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider, context, ethnode.chainId)).to.be.true
      })
      it('Should validate sequence wallet signature using direct method', async () => {
        const signature = await wallet.signMessage(message)
        expect(await isValidSequenceUndeployedWalletSignature(wallet.address, digest, signature, context, ethnode.provider)).to.be
          .true
      })
      it('Should reject sequence wallet invalid signature', async () => {
        const wallet2 = (
          await lib.Wallet.singleOwner(new ethers.Wallet(ethers.utils.randomBytes(32)), { ...context, nonStrict: true })
        ).setProvider(ethnode.provider)
        const signature = await wallet2.signMessage(message, 1)
        expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider, context)).to.be.false
      })
      it('Should reject signature with not enough weight', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 2,
          signers: [
            {
              address: s1.address,
              weight: 1
            },
            {
              address: s2.address,
              weight: 1
            }
          ]
        }

        const wallet2 = new lib.Wallet({ config: newConfig, context }, s1).connect(ethnode.provider, relayer)
        const signature = await wallet2.signMessage(message)
        expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider, context, 1)).to.be.false
      })
      it('Should reject signature with not enough weight but enough signers', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s3 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 2,
          signers: [
            {
              address: s1.address,
              weight: 0
            },
            {
              address: s2.address,
              weight: 0
            },
            {
              address: s3.address,
              weight: 1
            }
          ]
        }

        const wallet2 = new lib.Wallet({ config: newConfig, context, strict: false }, s1, s2).connect(ethnode.provider, relayer)
        const signature = await wallet2.signMessage(message)
        expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider, context, ethnode.chainId)).to.be.false
      })
      it('Should be able to just deploy a new wallet and have valid signatures', async () => {
        const pk = ethers.utils.randomBytes(32)
        const wallet2 = (await lib.Wallet.singleOwner(pk, context)).connect(ethnode.provider, relayer)
        const signature = await wallet2.sign(message, false, ethnode.chainId)
        expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider)).to.not.be.true
        await wallet2.sendTransaction([])
        expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider)).to.be.true
      })
    })
    describe('deployed wallet sign', () => {
      it('Should validate wallet signature', async () => {
        const signature = await wallet.signMessage(message)
        await relayer.deployWallet(wallet.config, context)
        expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider)).to.be.true
      })
      it('Should validate wallet signature using direct method', async () => {
        const signature = await wallet.signMessage(message)
        await relayer.deployWallet(wallet.config, context)
        expect(await isValidContractWalletSignature(wallet.address, digest, signature, ethnode.provider)).to.be.true
      })
      it('Should reject invalid wallet signature', async () => {
        const wallet2 = (await lib.Wallet.singleOwner(new ethers.Wallet(ethers.utils.randomBytes(32)), context)).setProvider(
          ethnode.provider
        )
        const signature = await wallet2.signMessage(message, ethnode.chainId)
        await relayer.deployWallet(wallet.config, context)
        expect(await isValidSignature(wallet.address, digest, signature, ethnode.provider, context)).to.be.false
      })
    })
    it('Should sign typed data', async () => {
      const proof = new Proof({
        address: wallet.address
      })

      proof.setExpiryIn(3e7) // 1 year
      proof.claims.app = 'SkyWeaver'

      const messageTypedData = proof.messageTypedData()

      const sigResp = await wallet.signTypedData(messageTypedData.domain, messageTypedData.types, messageTypedData.message)

      await relayer.deployWallet(wallet.config, wallet.context)

      expect(
        await new Contract(wallet.address, MainModuleArtifact.abi, wallet.provider)['isValidSignature(bytes32,bytes)'](
          proof.messageDigest(),
          sigResp
        )
      ).to.equal('0x1626ba7e')
    })
    describe('Broken signers', () => {
      describe('Broken EOA signer', async () => {
        let s1: ethers.Wallet
        let s2: ethers.Wallet
        let config: WalletConfig

        beforeEach(() => {
          s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
          s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

          s2.signMessage = (() => {
            throw Error('ups')
          }) as any

          config = {
            threshold: 1,
            signers: [
              {
                address: s1.address,
                weight: 1
              },
              {
                address: s2.address,
                weight: 1
              }
            ]
          }
        })

        it('Should skip broken signer', async () => {
          const wallet2 = new lib.Wallet({ config: config, context }, s1, s2).connect(ethnode.provider, relayer)
          const signature = await wallet2.signMessage(message, await wallet2.getChainId(), false)
          expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider, context, ethnode.chainId)).to.be
            .true
        })
        it('Should reject broken signer', async () => {
          const wallet2 = new lib.Wallet({ config: config, context }, s1, s2).connect(ethnode.provider, relayer)
          const signature = wallet2.signMessage(message, await wallet2.getChainId(), true)
          await expect(signature).to.be.rejected
        })
      })
      describe('Broken nested sequence signer', async () => {
        let s1: ethers.Wallet
        let w2: lib.Wallet
        let config: WalletConfig

        beforeEach(async () => {
          s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

          const walletA = (await lib.Wallet.singleOwner(ethers.Wallet.createRandom(), context)).connect(ethnode.provider, relayer)
          w2 = (await lib.Wallet.singleOwner(walletA, context)).connect(ethnode.provider, relayer)

          // TODO: Bundle deployment with child wallets
          await relayer.deployWallet(walletA.config, walletA.context)

          w2.sign = (() => {
            throw Error('ups')
          }) as any

          config = {
            threshold: 1,
            signers: [
              {
                address: s1.address,
                weight: 1
              },
              {
                address: w2.address,
                weight: 1
              }
            ]
          }
        })

        it('Should skip broken nested signer', async () => {
          const wallet2 = new lib.Wallet({ config: config, context }, s1, w2).connect(ethnode.provider, relayer)
          const signature = await wallet2.signMessage(message, await wallet2.getChainId(), false)
          expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider, context, ethnode.chainId)).to.be
            .true
        })
        it('Should reject broken nested signer', async () => {
          const wallet2 = new lib.Wallet({ config: config, context }, s1, w2).connect(ethnode.provider, relayer)
          const signature = wallet2.signMessage(message, await wallet2.getChainId(), true)
          await expect(signature).to.be.rejected
        })
      })
      describe('Broken remote signer', async () => {
        let s1: ethers.Wallet
        let r2: RemoteSigner
        let config: WalletConfig

        beforeEach(async () => {
          s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

          const r2Addr = ethers.Wallet.createRandom().address

          r2 = {
            _isSigner: true,
            getAddress: async () => r2Addr,
            signMessageWithData: () => {
              throw Error('Ups')
            }
          } as any

          config = {
            threshold: 1,
            signers: [
              {
                address: s1.address,
                weight: 1
              },
              {
                address: await r2.getAddress(),
                weight: 1
              }
            ]
          }
        })

        it('Should skip broken remote signer', async () => {
          const wallet2 = new lib.Wallet({ config: config, context }, s1, r2).connect(ethnode.provider, relayer)
          const signature = await wallet2.signMessage(message, await wallet2.getChainId(), false)
          expect(await isValidSignature(wallet2.address, digest, signature, ethnode.provider, context, ethnode.chainId)).to.be
            .true
        })
        it('Should reject broken remote signer', async () => {
          const wallet2 = new lib.Wallet({ config: config, context }, r2).connect(ethnode.provider, relayer)
          const signature = wallet2.signMessage(message, await wallet2.getChainId(), true)
          await expect(signature).to.be.rejected
        })
      })
    })
  })
  describe('Update wallet configuration', () => {
    let transaction: Transactionish
    beforeEach(async () => {
      transaction = {
        from: wallet.address,
        gasPrice: '20000000000',
        to: callReceiver.address,
        value: 0,
        data: await encodeData(callReceiver, 'testCall', 123, '0x445566')
      }
    })
    it('Should migrate and update to a new single owner configuration', async () => {
      const address = await wallet.getAddress()

      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 1,
        signers: [
          {
            address: s1.address,
            weight: 1
          }
        ]
      }

      expect(await wallet.isDeployed()).to.be.false

      const [updatedConfig, tx] = await wallet.updateConfig(newConfig)
      await tx.wait()

      expect(await wallet.isDeployed()).to.be.true

      const updatedWallet = wallet.useConfig(updatedConfig).useSigners(s1)
      expect(updatedWallet.imageHash).to.equal(await fetchImageHash(updatedWallet))
      expect(await updatedWallet.getAddress()).to.equal(address)

      expect(
        ethers.utils.defaultAbiCoder.decode(['address'], await ethnode.provider.getStorageAt(wallet.address, wallet.address))[0]
      ).to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))

      expect(updatedWallet.address).to.be.equal(wallet.address)
      expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))

      await updatedWallet.sendTransaction(transaction)
    })
    it('Should migrate and update to a new multiple owner configuration', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 2,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const [config, tx] = await wallet.updateConfig(newConfig)
      await tx.wait()

      const updatedWallet = new lib.Wallet({ config, context }, s1, s2).connect(ethnode.provider, relayer)

      expect(
        ethers.utils.defaultAbiCoder.decode(['address'], await ethnode.provider.getStorageAt(wallet.address, wallet.address))[0]
      ).to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))

      expect(updatedWallet.address).to.be.equal(wallet.address)
      expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))

      await updatedWallet.sendTransaction(transaction)
    })
    it('Should skip mainModule implementation upgrade if already up to date', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 2,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const oldConfig = wallet.config
      const [config, tx] = await wallet.updateConfig(newConfig)
      await tx.wait()

      const updatedWallet = new lib.Wallet({ config, context }, s1, s2).connect(ethnode.provider, relayer)

      const updateTx = await updatedWallet.buildUpdateConfigTransaction(oldConfig, true, true)

      const mainModuleInterface = new Interface(walletContracts.mainModule.abi)
      const mainModuleUpgradableInterface = new Interface(walletContracts.mainModuleUpgradable.abi)
      const sequenceUtilsInterface = new Interface(walletContracts.sequenceUtils.abi)

      expect(updateTx.length).to.equal(1)

      const decoded = mainModuleInterface.decodeFunctionData('selfExecute', updateTx[0].data)[0]
      expect(decoded.length).to.equal(2)

      const decoded0 = mainModuleUpgradableInterface.decodeFunctionData('updateImageHash', decoded[0].data)
      expect(decoded0).to.not.be.undefined

      const decoded1 = sequenceUtilsInterface.decodeFunctionData('publishConfig', decoded[1].data)
      expect(decoded1).to.not.be.undefined
    })
    it('Should skip selfExecute if update requires a single transaction', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 2,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const oldConfig = wallet.config
      const [config, tx] = await wallet.updateConfig(newConfig)
      await tx.wait()

      const updatedWallet = new lib.Wallet({ config, context }, s1, s2).connect(ethnode.provider, relayer)

      const updateTx = await updatedWallet.buildUpdateConfigTransaction(oldConfig, false)

      const mainModuleInterface = new Interface(walletContracts.mainModule.abi)
      const mainModuleUpgradableInterface = new Interface(walletContracts.mainModuleUpgradable.abi)

      expect(updateTx.length).to.equal(1)

      await expect((async () => mainModuleInterface.decodeFunctionData('selfExecute', updateTx[0].data))()).to.be.rejected

      const decoded = mainModuleUpgradableInterface.decodeFunctionData('updateImageHash', updateTx[0].data)
      expect(decoded).to.not.be.undefined
    })
    it('Should migrate and publish config', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 2,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const [, tx] = await wallet.updateConfig(newConfig, undefined, true)
      const receipt = await tx.wait()
      expect(receipt.logs[6].data).to.contain(s1.address.slice(2).toLowerCase())
      expect(receipt.logs[6].data).to.contain(s2.address.slice(2).toLowerCase())
    })
    it('Should publish config', async () => {
      const receipt = await (await wallet.publishConfig()).wait()
      expect(receipt.logs[3].data).to.contain(wallet.config.signers[0].address.slice(2).toLowerCase())
    })
    describe('after migrating and updating', () => {
      let wallet2: lib.Wallet

      beforeEach(async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 1,
          signers: [
            {
              address: s1.address,
              weight: 1
            }
          ]
        }

        const [config, tx] = await wallet.updateConfig(newConfig)
        await tx.wait()

        wallet2 = new lib.Wallet({ config, context }, s1).connect(ethnode.provider, relayer)
      })
      it('Should update to a new single owner configuration', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 1,
          signers: [
            {
              address: s1.address,
              weight: 1
            }
          ]
        }

        const [config, tx] = await wallet2.updateConfig(newConfig)
        await tx.wait()

        const updatedWallet = new lib.Wallet({ config, context }, s1).connect(ethnode.provider, relayer)

        expect(
          ethers.utils.defaultAbiCoder.decode(
            ['address'],
            await ethnode.provider.getStorageAt(wallet2.address, wallet2.address)
          )[0]
        ).to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))

        expect(updatedWallet.address).to.be.equal(wallet2.address)
        expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))

        await updatedWallet.sendTransaction(transaction)
      })
      it('Should update to a new multiple owner configuration', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const newConfig = {
          threshold: 2,
          signers: [
            {
              address: s1.address,
              weight: 1
            },
            {
              address: s2.address,
              weight: 1
            }
          ]
        }

        const [config, tx] = await wallet2.updateConfig(newConfig)
        await tx.wait()

        const updatedWallet = new lib.Wallet({ config, context }, s1, s2).connect(ethnode.provider, relayer)

        expect(
          ethers.utils.defaultAbiCoder.decode(
            ['address'],
            await ethnode.provider.getStorageAt(wallet2.address, wallet2.address)
          )[0]
        ).to.equal(ethers.utils.getAddress(context.mainModuleUpgradable))

        expect(updatedWallet.address).to.be.equal(wallet2.address)
        expect(updatedWallet.address).to.not.be.equal(addressOf(newConfig, context))

        await updatedWallet.sendTransaction(transaction)
      })
      it('Should reject transaction of previous owner', async () => {
        const tx = wallet.sendTransaction(transaction)
        expect(tx).to.be.rejected
      })
    })
    it('Should reject a non-usable configuration', async () => {
      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 3,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const prom = wallet.buildUpdateConfigTransaction(newConfig)
      await expect(prom).to.be.rejected
    })
    it('Should accept a non-usable configuration in non-strict mode', async () => {
      const wallet = (
        await lib.Wallet.singleOwner(new ethers.Wallet(ethers.utils.randomBytes(32)), { ...context, nonStrict: true })
      ).connect(ethnode.provider, relayer)

      const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))

      const newConfig = {
        threshold: 3,
        signers: [
          {
            address: s1.address,
            weight: 1
          },
          {
            address: s2.address,
            weight: 1
          }
        ]
      }

      const prom = wallet.buildUpdateConfigTransaction(newConfig)
      await expect(prom).to.be.not.rejected
    })
  })
})
