import { deployArcadeum } from "./utils/arcadeum_config"
import { ethers, Wallet, Signer } from "ethers"
import * as Ganache from "ganache-cli"

import { CallReceiverMock } from "arcadeum-wallet/typings/contracts/CallReceiverMock"

import * as arcadeum from '../src'
import { LocalRelayer } from "../src"
import { expect } from "chai"
import { ArcadeumContext } from "../src/types"
import { AsyncSendable, Web3Provider } from "ethers/providers"

const CallReceiverMockArtifact = require("arcadeum-wallet/build/contracts/CallReceiverMock.json")
const Web3 = require('web3')

type GanacheInstance = {
  w3provider?: AsyncSendable,
  provider?: Web3Provider,
  signer?: Signer
}

describe('Arcadeum wallet integration', function() {
  let ganache: GanacheInstance = {}

  let relayer: LocalRelayer
  let callReceiver: CallReceiverMock

  let context: ArcadeumContext
  let wallet: arcadeum.Wallet

  before(async () => {
    // Deploy Ganache test env
    ganache.w3provider = Ganache.provider()
    ganache.provider = new ethers.providers.Web3Provider(ganache.w3provider)
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

    // Deploy local relayer
    relayer = new LocalRelayer(ganache.signer)
  })

  beforeEach(async () => {
    // Create wallet
    const pk = ethers.utils.randomBytes(32)
    wallet = await arcadeum.Wallet.singleOwner(context, pk)
    wallet = wallet.connect(ganache.w3provider, relayer)
  })

  describe('with ethers js', () => {
    let w3provider: AsyncSendable
    let provider: Web3Provider

    beforeEach(async () => {
      w3provider = new arcadeum.Provider(wallet)
      provider = new ethers.providers.Web3Provider(w3provider)
    })

    it('Should call contract method', async () => {
      const contractWithSigner = callReceiver.connect(wallet) as CallReceiverMock

      await contractWithSigner.testCall(412313, "0x11222334")
      expect(await contractWithSigner.lastValB()).to.equal("0x11222334")
    })

    it('Should deploy contract', async () => {
      await new ethers.ContractFactory(
        CallReceiverMockArtifact.abi,
        CallReceiverMockArtifact.bytecode,
        wallet
      ).deploy() as CallReceiverMock
    })

    it('Should perform multiple transactions', async () => {
      const contractWithSigner = callReceiver.connect(wallet) as CallReceiverMock

      await contractWithSigner.testCall(412313, "0x11222334")
      await contractWithSigner.testCall(11111, "0x")
    })

    it('Should return transaction count', async () => {
      const contractWithSigner = callReceiver.connect(wallet) as CallReceiverMock

      expect(await provider.getTransactionCount(wallet.address)).to.equal(0)

      await contractWithSigner.testCall(1, "0x")
      expect(await provider.getTransactionCount(wallet.address)).to.equal(100)

      await contractWithSigner.testCall(2, "0x")
      expect(await provider.getTransactionCount(wallet.address)).to.equal(200)

      await contractWithSigner.testCall(3, "0x")
      expect(await provider.getTransactionCount(wallet.address)).to.equal(300)
    })
  })
  describe('with web3', () => {
    let w3provider: AsyncSendable
    let w3: any

    beforeEach(async () => {
      w3provider = new arcadeum.Provider(wallet)
      w3 = new Web3(w3provider)
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
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(100)

      await contractWithSigner.methods.testCall(2, "0x").send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(200)

      await contractWithSigner.methods.testCall(3, "0x").send({ from: wallet.address })
      expect(await w3.eth.getTransactionCount(wallet.address)).to.equal(300)
    })
  })
})
