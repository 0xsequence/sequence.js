import { ethers, Signer } from 'ethers'

import { CallReceiverMock } from 'arcadeum-wallet/typings/contracts/CallReceiverMock'

import * as arcadeum from '../src'
import { RpcRelayer } from '../src'

import * as chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { IRelayer } from '../src/relayer'
import { toArcadeumTransaction } from '../src/utils'

const CallReceiverMockArtifact = require('arcadeum-wallet/artifacts/CallReceiverMock.json')

const { expect } = chai.use(chaiAsPromised)

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
  describe.only('Arcadeum wallet integration', function () {
    let relayer: IRelayer

    let wallet: arcadeum.Wallet
    let signer: Signer

    let callReceiver: CallReceiverMock

    (this as any).timeout(0)

    before(async () => {
      const provider = new ethers.providers.JsonRpcProvider(eth_rpc, 4) // poa 692402
      signer = new ethers.Wallet(pk).connect(provider)

      relayer = new RpcRelayer(relayer_rpc, false, provider)

      // Create wallet
      wallet = await arcadeum.Wallet.singleOwner(ARCADEUM_CONTEXT, ethers.utils.randomBytes(32))
      wallet = wallet.connect(eth_rpc, relayer)

      // Deploy call receiver mock
      callReceiver = (await new ethers.ContractFactory(
        CallReceiverMockArtifact.abi,
        CallReceiverMockArtifact.bytecode,
        signer
      ).deploy()) as CallReceiverMock
      await callReceiver.deployTransaction.wait()
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
            data: callReceiver.interface.functions.testCall.encode([24123, data])
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
            data: callReceiver.interface.functions.testCall.encode([5512, data2])
          }
        ]

        const tx2 = await wallet.sendTransaction(transaction2)
        await tx2.wait()

        expect((await callReceiver.lastValA()).toString()).to.equal("5512")
      })
    })
  })
}
