/*import { ethers, Signer } from 'ethers'

import { CallReceiverMock } from 'arcadeum-wallet/typings/contracts/ethers-v5/CallReceiverMock'
import { encodeData } from './utils'

import * as arcadeum from '../src'
import { RpcRelayer } from '../src'

// import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { Relayer } from '../src/relayer'
import { toSequenceTransaction, toSequenceTransactions } from '../src/utils'

const CallReceiverMockArtifact = require('arcadeum-wallet/artifacts/CallReceiverMock.json')

// const { expect } = chai.use(chaiAsPromised)
import { expect } from 'chai'

const ARCADEUM_CONTEXT = {
  factory: '0x52f0F4258c69415567b21dfF085C3fd5505D5155',
  mainModule: '0x57bA6Eb1ed6821Db7bC26C6714f093E2BCbea40F',
  mainModuleUpgradable: '0xF52136A04057d889CeBf9bCc2F3142965AeABc54',
  guestModule: '0xe076ad01F1eb18A8eF20bB64003DA4810a429a32'
}

const pk = process.env.TEST_PK
const eth_rpc = process.env.TEST_ETH_RPC
const relayer_rpc = process.env.TEST_RELAYER_RPC

if (process.env.ONLY_E2E) {
  describe('ContractWallet integration (e2e)', function () {
    let relayer: Relayer

    let wallet: arcadeum.ContractWallet
    let signer: Signer

    let callReceiver: CallReceiverMock

    (this as any).timeout(0)

    before(async () => {
      const provider = new ethers.providers.JsonRpcProvider(eth_rpc, 4) // poa 692402
      signer = new ethers.Wallet(pk).connect(provider)

      relayer = new RpcRelayer(relayer_rpc, false, provider)

      // Create wallet
      wallet = await arcadeum.ContractWallet.singleOwner(ARCADEUM_CONTEXT, ethers.utils.randomBytes(32))
      wallet = wallet.connect(eth_rpc, relayer)

      // Deploy call receiver mock
      callReceiver = (await new ethers.ContractFactory(
        CallReceiverMockArtifact.abi,
        CallReceiverMockArtifact.bytecode,
        signer
      ).deploy()) as CallReceiverMock
      await callReceiver.deployTransaction.wait(2)
    })

    if (process.env.ONLY_E2E_WITH_FEE) {
      describe('Append gas refund options', () => {
        it('Should get gas refund options', async () => {
          await callReceiver.testCall(0, '0x')

          const transactions = [{
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, "0x445566")
          }]

          const arctx = await toSequenceTransactions(wallet, transactions)
          const estimated = await relayer.gasRefundOptions(wallet.config, ARCADEUM_CONTEXT, ...arctx)
          expect(estimated[0].length).to.be.above(transactions.length)
        })
      })
    } else {
      describe('Estimate gas limit', () => {
        it('Should estimate gasLimit for a single transaction', async () => {
          await callReceiver.testCall(0, '0x')

          const transactions = [{
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, "0x445566")
          }]

          const arctx = await toSequenceTransactions(wallet, transactions)
          const estimated = await relayer.estimateGasLimits(wallet.config, ARCADEUM_CONTEXT, ...arctx)
          expect((<any>estimated[0].gasLimit).toNumber()).to.be.above(60000)
          expect((<any>estimated[0].gasLimit).toNumber()).to.be.below(100000)
        })
        it('Should estimate gas for a single big meta-tx', async () => {
          await callReceiver.testCall(0, '0x')

          const data = ethers.utils.randomBytes(1024)
          const transaction = {
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, data)
          }

          const arctx = await toSequenceTransaction(wallet, transaction)
          const estimated = await relayer.estimateGasLimits(wallet.config, ARCADEUM_CONTEXT, arctx)
          expect((<any>estimated[0].gasLimit).toNumber()).to.be.above(600000)
          expect((<any>estimated[0].gasLimit).toNumber()).to.be.below(1000000)
        })
        it('Should estimate gasLimit for multiple transactions', async () => {
          await callReceiver.testCall(0, '0x')

          const data = ethers.utils.randomBytes(512)
          const transactions = [{
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, data)
          }, {
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, '0x445566')
          }]

          const arctxs = await toSequenceTransactions(wallet, transactions)
          const estimated = await relayer.estimateGasLimits(wallet.config, ARCADEUM_CONTEXT, ...arctxs)
          expect((<any>estimated[0].gasLimit).toNumber()).to.be.above(600000)
          expect((<any>estimated[0].gasLimit).toNumber()).to.be.below(1000000)
          expect((<any>estimated[1].gasLimit).toNumber()).to.be.above(60000)
          expect((<any>estimated[1].gasLimit).toNumber()).to.be.below(100000)
        })
        it('Should send meta-tx with estimate gasLimits', async () => {
          await callReceiver.testCall(0, '0x')

          const data = ethers.utils.randomBytes(1024)
          const transactions = [{
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 1000000,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 743533, data)
          }]

          const arctxs = await toSequenceTransactions(wallet, transactions, true)
          const estimated = await relayer.estimateGasLimits(wallet.config, ARCADEUM_CONTEXT, ...arctxs)
          const tx = await wallet.sendTransaction(estimated)
          await tx.wait(2)

          expect((await callReceiver.lastValA()).toString()).to.equal("743533")
        })
        it('Should send meta-txs with estimate gasLimits', async () => {
          await callReceiver.testCall(0, '0x')

          const data = ethers.utils.randomBytes(2048)
          const transactions = [{
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 123, data)
          }, {
            from: wallet.address,
            gasPrice: '20000000000',
            gasLimit: 0,
            to: callReceiver.address,
            value: 0,
            data: await encodeData(callReceiver, 'testCall', 7435, '0x445566')
          }]

          const arctxs = await toSequenceTransactions(wallet, transactions, true)
          const estimated = await relayer.estimateGasLimits(wallet.config, ARCADEUM_CONTEXT, ...arctxs)
          const tx = await wallet.sendTransaction(estimated)
          await tx.wait(2)

          expect((await callReceiver.lastValA()).toString()).to.equal("7435")
        })
      })
      describe('Send transactions', () => {
        it('Should wait for transaction receipt', async () => {
          const data = ethers.utils.randomBytes(512)
          const transaction = [
            {
              gasPrice: '20000000000',
              gasLimit: '921987',
              to: callReceiver.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 24123, data)
            }
          ]

          const tx = await wallet.sendTransaction(transaction)

          const receipt = await tx.wait()
          expect(receipt.to).to.exist
          expect(receipt.from).to.exist
          expect(receipt.gasUsed).to.exist
          expect(receipt.blockHash).to.exist
          expect(receipt.transactionHash).to.exist
          expect(receipt.logs).to.exist
          expect(receipt.blockNumber).to.exist
          expect(receipt.confirmations).to.exist
          expect(receipt.cumulativeGasUsed).to.exist
          expect(receipt.status).to.exist

          expect((await callReceiver.lastValA()).toString()).to.equal("24123")
        })
        it('Should use the nonce of the relayer', async () => {
          const addr = ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20)))
          const data = ethers.utils.randomBytes(32)
          const transaction = [
            {
              gasPrice: '20000000000',
              gas: '121000',
              to: addr,
              value: 0,
              data: data
            }
          ]

          const tx = await wallet.sendTransaction(transaction)
          await tx.wait()

          const data2 = ethers.utils.randomBytes(16)
          const transaction2 = [
            {
              gasPrice: '20000000000',
              gas: '121000',
              to: callReceiver.address,
              value: 0,
              data: await encodeData(callReceiver, 'testCall', 5512, data2)
            }
          ]

          const tx2 = await wallet.sendTransaction(transaction2)
          await tx2.wait()

          expect((await callReceiver.lastValA()).toString()).to.equal("5512")
        })
      })
    }
  })
}
*/