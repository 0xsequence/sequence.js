import { deployArcadeum } from "./utils/arcadeum_config"
import { ethers, Signer } from "ethers"
import * as Ganache from "ganache-cli"

import { CallReceiverMock } from "arcadeum-wallet/typings/contracts/CallReceiverMock"
import { HookCallerMock } from "arcadeum-wallet/typings/contracts/HookCallerMock"

import * as arcadeum from '../src'
import { LocalRelayer } from "../src"
import { ArcadeumContext } from "../src/types"
import { AsyncSendable, Web3Provider, JsonRpcProvider } from "ethers/providers"
import { Signer as AbstractSigner } from "ethers"

import * as chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

const CallReceiverMockArtifact = require("arcadeum-wallet/build/contracts/CallReceiverMock.json")
const HookCallerMockArtifact = require("arcadeum-wallet/build/contracts/HookCallerMock.json")

const Web3 = require('web3')
const { expect } = chai.use(chaiAsPromised)

const GANACHE_PORT = 38545

type GanacheInstance = {
  server?: any,
  serverUri?: string,
  provider?: JsonRpcProvider,
  signer?: Signer
}

describe('Arcadeum wallet integration', function() {
  let ganache: GanacheInstance = {}

  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock
  let hookCaller: HookCallerMock

  let context: ArcadeumContext
  let wallet: arcadeum.Wallet

  before(async () => {
    // Deploy Ganache test env
    ganache.server = Ganache.server()
    await ganache.server.listen(GANACHE_PORT)
    ganache.serverUri = `http://localhost:${GANACHE_PORT}/`
    ganache.provider = new ethers.providers.JsonRpcProvider(ganache.serverUri)
    ganache.signer = ganache.provider.getSigner()

    // Deploy Arcadeum env
    const [factory, mainModule] = await deployArcadeum(ganache.provider)

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address
    }

    // Deploy call receiver mock
    callReceiver = await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      ganache.signer
    ).deploy() as CallReceiverMock

    // Deploy hook caller mock
    hookCaller = await new ethers.ContractFactory(
      HookCallerMockArtifact.abi,
      HookCallerMockArtifact.bytecode,
      ganache.signer
    ).deploy() as HookCallerMock

    // Deploy local relayer
    relayer = new LocalRelayer(ganache.signer)
  })

  beforeEach(async () => {
    // Create wallet
    const pk = ethers.utils.randomBytes(32)
    wallet = await arcadeum.Wallet.singleOwner(context, pk)
    wallet = wallet.connect(ganache.serverUri, relayer)
  })

  after(async () => {
    ganache.server.close()
  })

  describe('with ethers js', () => {
    let w3provider: AsyncSendable
    let provider: Web3Provider

    let options = [
      {
        name: 'wallet',
        signer: () => wallet
      }, {
        name: 'provider',
        signer: () => provider.getSigner()
      }
    ]

    beforeEach(async () => {
      w3provider = new arcadeum.Provider(wallet)
      provider = new ethers.providers.Web3Provider(w3provider)
    })

    it('Should return accounts', async () => {
      const accounts = await provider.listAccounts()
      expect(accounts.length).to.be.equal(1)
      expect(accounts[0]).to.be.equal(wallet.address)
    })

    options.forEach(s => {
      describe(`using ${s.name} provider`, () => {
        let signer: AbstractSigner

        beforeEach(async () => {
          signer = s.signer()
        })

        it('Should call contract method', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock
    
          await contractWithSigner.testCall(412313, "0x11222334")
          expect(await contractWithSigner.lastValB()).to.equal("0x11222334")
        })
    
        it('Should deploy contract', async () => {
          await new ethers.ContractFactory(
            CallReceiverMockArtifact.abi,
            CallReceiverMockArtifact.bytecode,
            signer
          ).deploy() as CallReceiverMock
        })
    
        it('Should perform multiple transactions', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock
    
          await contractWithSigner.testCall(412313, "0x11222334")
          await contractWithSigner.testCall(11111, "0x")
        })
    
        it('Should return transaction count', async () => {
          const contractWithSigner = callReceiver.connect(signer) as CallReceiverMock
    
          expect(await provider.getTransactionCount(wallet.address)).to.equal(0)
    
          await contractWithSigner.testCall(1, "0x")
          expect(await provider.getTransactionCount(wallet.address)).to.equal(1)
    
          await contractWithSigner.testCall(2, "0x")
          expect(await provider.getTransactionCount(wallet.address)).to.equal(2)
    
          await contractWithSigner.testCall(3, "0x")
          expect(await provider.getTransactionCount(wallet.address)).to.equal(3)
        })

        describe('signing', async () => {
          it('Should sign a message', async () => {
            const message = ethers.utils.arrayify(ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Hi! this is a test message")))
    
            const signature = await signer.signMessage(message)
    
            // Contract wallet must be deployed before calling ERC1271
            await relayer.deploy(wallet.config, context)
    
            const digest = ethers.utils.hashMessage(message)
            const call = hookCaller.callERC1271isValidSignatureData(wallet.address, digest, signature)
            await expect(call).to.be.fulfilled
          })
        })
      })
    })
  })
  describe('with web3', () => {
    let w3provider: AsyncSendable
    let w3: any

    beforeEach(async () => {
      w3provider = new arcadeum.Provider(wallet)
      w3 = new Web3(w3provider)
    })

    it('Should return accounts', async () => {
      const accounts = await w3.eth.getAccounts()
      expect(accounts.length).to.be.equal(1)
      expect(accounts[0]).to.be.equal(wallet.address)
    })

    it('Should call contract method', async () => {
      const contractWithSigner = new w3.eth.Contract(
        CallReceiverMockArtifact.abi,
        callReceiver.address
      )

      await contractWithSigner.methods.testCall(412313, "0x11222334").send({ from: wallet.address })
      expect(await contractWithSigner.methods.lastValB().call()).to.equal("0x11222334")
    })

    it('Should deploy contract', async () => {
      const contractWithSigner = new w3.eth.Contract(CallReceiverMockArtifact.abi)
      await contractWithSigner.deploy({ data: CallReceiverMockArtifact.bytecode })
    })

    it('Should perform multiple transactions', async () => {
      const contractWithSigner = new w3.eth.Contract(
        CallReceiverMockArtifact.abi,
        callReceiver.address
      )

      await contractWithSigner.methods.testCall(412313, "0x11222334").send({ from: wallet.address })
      await contractWithSigner.methods.testCall(11111, "0x").send({ from: wallet.address })
    })

    it('Should return transaction count', async () => {
      const contractWithSigner = new w3.eth.Contract(
        CallReceiverMockArtifact.abi,
        callReceiver.address
      )

      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(0)

      await contractWithSigner.methods.testCall(1, "0x").send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(1)

      await contractWithSigner.methods.testCall(2, "0x").send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(2)

      await contractWithSigner.methods.testCall(3, "0x").send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(3)
    })

    describe('signing', async () => {
      it('Should sign transaction', async () => {
        const signed = await w3.eth.signTransaction({
          from: wallet.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: '0x3535353535353535353535353535353535353535',
          value: '1000000000000000000',
          data: '0x9988776655'
        })
  
        expect(signed.raw).to.be.a('string')
        expect(signed.tx.gas).to.equal('0x1d8a8')
        expect(signed.tx.to).to.equal('0x3535353535353535353535353535353535353535')
        expect(signed.tx.value).to.equal('0xde0b6b3a7640000')
        expect(signed.tx.input).to.equal('0x9988776655')
        expect(signed.tx.data).to.equal(signed.tx.input)
        expect(signed.tx.target).to.equal(signed.tx.to)
        expect(signed.tx.delegateCall).to.equal(false)
        expect(signed.tx.revertOnError).to.equal(false)
      })

      it('Should sign a message', async () => {
        const message = "Hi! this is a test message"

        const signature = await w3.eth.sign(message, wallet.address)

        // Contract wallet must be deployed before calling ERC1271
        await relayer.deploy(wallet.config, context)

        const digest = ethers.utils.hashMessage(ethers.utils.toUtf8Bytes(message))
        const call = hookCaller.callERC1271isValidSignatureData(wallet.address, digest, signature)
        await expect(call).to.be.fulfilled
      })

      it('Should sign and send transaction', async () => {
        const signed = await w3.eth.signTransaction({
          from: wallet.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: callReceiver.address,
          value: 0,
          data: callReceiver.interface.functions.testCall.encode([123, "0x445566"])
        })

        const tx = await w3.eth.sendSignedTransaction(signed)
        expect(tx.transactionHash).to.be.a('string')

        expect(await callReceiver.lastValB()).to.equal('0x445566')
      })

      it('Should sign, aggregate and send a transaction', async () => {
        const s1 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s2 = new ethers.Wallet(ethers.utils.randomBytes(32))
        const s3 = new ethers.Wallet(ethers.utils.randomBytes(32))

        const config = {
          threshold: 3,
          signers: [{
            address: s1.address,
            weight: 1
          }, {
            address: s2.address,
            weight: 1
          }, {
            address: s3.address,
            weight: 1
          }]
        }

        const wallet_1 = new arcadeum.Wallet(config, context, s1).connect(ganache.serverUri, relayer)
        const wallet_2 = new arcadeum.Wallet(config, context, s2).connect(ganache.serverUri, relayer)
        const wallet_3 = new arcadeum.Wallet(config, context, s3).connect(ganache.serverUri, relayer)

        expect(wallet_1.address).to.equal(wallet_2.address)
        expect(wallet_2.address).to.equal(wallet_3.address)

        const w3_1 = new Web3(new arcadeum.Provider(wallet_1))
        const w3_2 = new Web3(new arcadeum.Provider(wallet_2))
        const w3_3 = new Web3(new arcadeum.Provider(wallet_3))

        const transaction = {
          from: wallet_1.address,
          gasPrice: '20000000000',
          gas: '121000',
          to: callReceiver.address,
          value: 0,
          data: callReceiver.interface.functions.testCall.encode([123, "0x445566"])
        }

        const signed_1 = await w3_1.eth.signTransaction(transaction)
        const signed_2 = await w3_2.eth.signTransaction(transaction)
        const signed_3 = await w3_3.eth.signTransaction(transaction)

        const full_signed = {
          raw: arcadeum.utils.aggregate(signed_1.raw, signed_2.raw, signed_3.raw),
          tx: signed_1.tx
        }

        const tx = await w3_1.eth.sendSignedTransaction(full_signed)
        expect(tx.transactionHash).to.be.a('string')

        expect(await callReceiver.lastValB()).to.equal('0x445566')
      })
    })
  })
})
