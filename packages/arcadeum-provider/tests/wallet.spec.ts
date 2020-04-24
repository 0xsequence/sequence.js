import { deployArcadeum } from "./utils/arcadeum_config"
import { ethers } from "ethers"
import * as Ganache from "ganache-cli"

import { CallReceiverMock } from "arcadeum-wallet/typings/contracts/CallReceiverMock"

import * as arcadeum from '../src'
import { LocalRelayer } from "../src"
import { expect } from "chai"
import { ArcadeumContext } from "../src/types"

var Web3 = require('web3');


const CallReceiverMockArtifact = require("arcadeum-wallet/build/contracts/CallReceiverMock.json")

describe('Arcadeum wallet', function() {
  let webprovider

  let ethsigner
  let ethprovider

  let relayer
  let callReceiver

  let context: ArcadeumContext
  let wallet: arcadeum.Wallet

  before(async () => {
    // Deploy Ganache test env
    webprovider = Ganache.provider()
    ethprovider = new ethers.providers.Web3Provider(webprovider)
    ethsigner = (ethprovider as any).getSigner()

    // Deploy Arcadeum env
    const [factory, mainModule] = await deployArcadeum(ethprovider)

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address
    }

    // Deploy call receiver mock
    callReceiver = await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      ethsigner
    ).deploy() as CallReceiverMock

    // Deploy local relayer
    relayer = new LocalRelayer(ethsigner)
  })

  beforeEach(async () => {
    // Create wallet
    const pk = ethers.utils.randomBytes(32)
    wallet = await arcadeum.Wallet.singleOwner(context, pk)
    wallet = wallet.connect(ethprovider, relayer)
  })

  describe('with ethers js', () => {
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
  })
  describe('with web3', () => {
    let w3

    beforeEach(async () => {
      const provider = new arcadeum.ArcadeumProvider(relayer, webprovider, wallet)
      w3 = new Web3(provider)
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
  })
})
