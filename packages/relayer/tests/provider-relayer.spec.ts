import { deployWalletContext } from './utils/deploy-wallet-context'

import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'

import { Wallet } from '@0xsequence/wallet'
import { LocalRelayer } from '@0xsequence/relayer'

import { WalletContext, Networks, NetworkConfig } from '@0xsequence/network'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ethers, Signer as AbstractSigner } from 'ethers'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const HookCallerMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/HookCallerMock.sol/HookCallerMock.json')

const { expect } = chai.use(chaiAsPromised)

import { computeMetaTxnHash, encodeNonce } from '@0xsequence/transactions'

type EthereumInstance = {
  chainId?: number
  providerUrl?: string,
  provider?: JsonRpcProvider
  signer?: AbstractSigner
}

describe('Wallet integration', function () {
  const ethnode: EthereumInstance = {}

  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock
  let hookCaller: HookCallerMock

  let context: WalletContext
  let networks: Networks

  before(async () => {
    // Provider from hardhat without a server instance
    ethnode.providerUrl = `http://localhost:9547/`
    ethnode.provider = new ethers.providers.JsonRpcProvider(ethnode.providerUrl)

    ethnode.signer = ethnode.provider.getSigner()
    ethnode.chainId = 31337

    // Deploy local relayer
    relayer = new LocalRelayer(ethnode.signer)

    networks = [{
      name: 'local',
      chainId: ethnode.chainId,
      provider: ethnode.provider,
      isDefaultChain: true,
      isAuthChain: true,
      relayer: relayer
    }] as NetworkConfig[]

    // Deploy Sequence env
    const [
      factory,
      mainModule,
      mainModuleUpgradable,
      guestModule,
      sequenceUtils,
      requireFreshSigner,
      sessionUtils
    ] = await deployWalletContext(ethnode.provider)

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address,
      mainModuleUpgradable: mainModuleUpgradable.address,
      guestModule: guestModule.address,
      sequenceUtils: sequenceUtils.address,
      sessionUtils: sessionUtils.address,
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
  })

  describe("Waiting for receipts", () => {
    [{
      name: "deployed",
      deployed: true
    }, {
      name: "undeployed",
      deployed: false
    }].map((c) => {
      var wallet: Wallet

      beforeEach(async () => {
        wallet = (await Wallet.singleOwner(ethers.Wallet.createRandom(), context)).connect(networks[0].provider, relayer)
        if (c.deployed) await wallet.deploy()
    
        expect(await wallet.isDeployed()).to.equal(c.deployed)
      })

      describe(`For ${c.name} wallet`, () => {
        it("Should get receipt of success transaction", async () => {
          const txn = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.utils.randomBytes(43),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }
    
          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, txn)
    
          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))
    
          const ogtx = await wallet.sendTransaction(txn)
          const receipt = await receiptPromise
    
          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })
        it("Should get receipt of success batch transaction", async () => {
          const txns = [{
            to: ethers.Wallet.createRandom().address,
            data: ethers.utils.randomBytes(43),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }, {
            to: ethers.Wallet.createRandom().address,
            data: ethers.utils.randomBytes(43),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }]
    
          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, ...txns)
    
          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))
    
          const ogtx = await wallet.sendTransaction(txns)
          const receipt = await receiptPromise
    
          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })
        it("Should get receipt of batch transaction with failed meta-txs", async () => {
          const txns = [{
            to: ethers.Wallet.createRandom().address,
            data: ethers.utils.randomBytes(43),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }, {
            to: context.factory,
            // 0xff not a valid factory method
            data: "0xffffffffffff",
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }]
    
          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, ...txns)
    
          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))
    
          const ogtx = await wallet.sendTransaction(txns)
          const receipt = await receiptPromise
    
          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })
        it("Should get receipt of failed transaction", async () => {
          const txn = {
            to: context.factory,
            // 0xff not a valid factory method
            data: "0xffffffffffff",
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }
    
          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, txn)
    
          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))
    
          const ogtx = await wallet.sendTransaction(txn)
          const receipt = await receiptPromise
    
          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })
        it("Find correct receipt between multiple other transactions", async () => {
          // Pre-txs
          const altWallet = (await Wallet.singleOwner(ethers.Wallet.createRandom(), context)).connect(networks[0].provider, relayer)
          await altWallet.deploy()
          expect(await altWallet.isDeployed()).to.equal(true)

          await Promise.all(new Array(8).fill(0).map(async (_, i) => {
            await altWallet.sendTransaction({
              to: ethers.Wallet.createRandom().address,
              data: ethers.utils.randomBytes(43),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0,
              nonce: encodeNonce(i, 0)
            })
          }))

          const txn = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.utils.randomBytes(43),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }
    
          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, txn)
    
          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))
    
          const ogtx = await wallet.sendTransaction(txn)

          // Post-txs
          await Promise.all(new Array(8).fill(0).map(async (_, i) => {
            await altWallet.sendTransaction({
              to: ethers.Wallet.createRandom().address,
              data: ethers.utils.randomBytes(43),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0,
              nonce: encodeNonce(i + 1000, 0)
            })
          }))

          const receipt = await receiptPromise
    
          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })
        it("Find correct receipt between multiple other failed transactions", async () => {
          // Pre-txs
          const altWallet = (await Wallet.singleOwner(ethers.Wallet.createRandom(), context)).connect(networks[0].provider, relayer)
          await altWallet.deploy()
          expect(await altWallet.isDeployed()).to.equal(true)

          await Promise.all(new Array(8).fill(0).map(async (_, i) => {
            await altWallet.sendTransaction({
              to: ethers.Wallet.createRandom().address,
              data: ethers.utils.randomBytes(43),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0,
              nonce: encodeNonce(i, 0)
            })
          }))

          await Promise.all(new Array(8).fill(0).map(async (_, i) => {
            await altWallet.sendTransaction({
              to: context.factory,
              // 0xff not a valid factory method
              data: "0xffffffffffff",
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0,
              nonce: encodeNonce(i + 1000, 0)
            })
          }))

          const txn = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.utils.randomBytes(43),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }
    
          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, txn)
    
          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))
    
          const ogtx = await wallet.sendTransaction(txn)

          const receipt = await receiptPromise
    
          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })
        it("Find failed tx receipt between multiple other failed transactions", async () => {
          // Pre-txs
          const altWallet = (await Wallet.singleOwner(ethers.Wallet.createRandom(), context)).connect(networks[0].provider, relayer)
          await altWallet.deploy()
          expect(await altWallet.isDeployed()).to.equal(true)

          await Promise.all(new Array(8).fill(0).map(async (_, i) => {
            await altWallet.sendTransaction({
              to: ethers.Wallet.createRandom().address,
              data: ethers.utils.randomBytes(43),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0,
              nonce: encodeNonce(i, 0)
            })
          }))

          await Promise.all(new Array(8).fill(0).map(async (_, i) => {
            await altWallet.sendTransaction({
              to: context.factory,
              // 0xff not a valid factory method
              data: "0xffffffffffff",
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0,
              nonce: encodeNonce(i + 1000, 0)
            })
          }))

          const txn = {
            to: context.factory,
            // 0xff not a valid factory method
            data: "0xffffffffffff",
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }
    
          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, txn)
    
          const receiptPromise = relayer.wait(id, 10000)
          await new Promise(r => setTimeout(r, 1000))
    
          const ogtx = await wallet.sendTransaction(txn)
          const receipt = await receiptPromise
    
          expect(receipt).to.not.be.undefined
          expect(receipt.hash).to.equal(ogtx.hash)
        })
        it("Should timeout receipt if transaction is never sent", async () => {
          const txn = {
            to: ethers.Wallet.createRandom().address,
            data: ethers.utils.randomBytes(43),
            delegateCall: false,
            revertOnError: false,
            gasLimit: 140000,
            value: 0,
            nonce: 0
          }

          const id = computeMetaTxnHash(wallet.address, ethnode.chainId, txn)
          const receiptPromise = relayer.wait(id, 2000)

          await expect(receiptPromise).to.be.rejectedWith(`Timeout waiting for transaction receipt ${id}`)
        })
        if (c.deployed) {
          it("Find correct receipt between multiple other failed transactions of the same wallet", async () => {
            // Pre-txs
            await Promise.all(new Array(8).fill(0).map(async (_, i) => {
              await wallet.sendTransaction({
                to: ethers.Wallet.createRandom().address,
                data: ethers.utils.randomBytes(43),
                delegateCall: false,
                revertOnError: false,
                gasLimit: 140000,
                value: 0,
                nonce: encodeNonce(i + 1000, 0)
              })
            }))
  
            await Promise.all(new Array(8).fill(0).map(async (_, i) => {
              await wallet.sendTransaction({
                to: context.factory,
                // 0xff not a valid factory method
                data: "0xffffffffffff",
                delegateCall: false,
                revertOnError: false,
                gasLimit: 140000,
                value: 0,
                nonce: encodeNonce(i + 2000, 0)
              })
            }))
  
            const txn = {
              to: ethers.Wallet.createRandom().address,
              data: ethers.utils.randomBytes(43),
              delegateCall: false,
              revertOnError: false,
              gasLimit: 140000,
              value: 0,
              nonce: 0
            }
      
            const id = computeMetaTxnHash(wallet.address, ethnode.chainId, txn)
      
            const receiptPromise = relayer.wait(id, 10000)
            await new Promise(r => setTimeout(r, 1000))
      
            const ogtx = await wallet.sendTransaction(txn)
  
            const receipt = await receiptPromise
      
            expect(receipt).to.not.be.undefined
            expect(receipt.hash).to.equal(ogtx.hash)
          })
        }
      })
    })
  })
})
