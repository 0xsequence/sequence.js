import { deployWalletContext } from './utils/deploy-wallet-context'

import { CallReceiverMock } from '@0xsequence/wallet-contracts/typings/contracts/CallReceiverMock'
import { HookCallerMock } from '@0xsequence/wallet-contracts/typings/contracts/HookCallerMock'


import { LocalRelayer } from '@0xsequence/relayer'

import { WalletContext, Networks, NetworkConfig } from '@0xsequence/network'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ethers, Signer as AbstractSigner } from 'ethers'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const HookCallerMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/HookCallerMock.sol/HookCallerMock.json')

const { expect } = chai.use(chaiAsPromised)

import { Session, ValidateSequenceDeployedContractAccountProof, ValidateSequenceUndeployedContractAccountProof } from '../src'
import { compareAddr } from '@0xsequence/config'

import * as mockServer from "mockttp"
import { ETHAuth } from '@0xsequence/ethauth'

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
    // ethnode.provider = new ethers.providers.Web3Provider(hardhat.network.provider.send)

    // NOTE: if you'd like to test with ganache or hardhat in server mode, just uncomment the line below
    // and make sure your ganache or hardhat instance is running separately
    // NOTE2: ganache will fail at getStorageAt(), as hardhat and ganache treat it a bit differently,
    // which is strange. Hardhat is at fault here IMHO.
    ethnode.providerUrl = `http://localhost:9546/`
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
      sequenceUtils
    ] = await deployWalletContext(ethnode.provider)

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address,
      mainModuleUpgradable: mainModuleUpgradable.address,
      guestModule: guestModule.address,
      sequenceUtils: sequenceUtils.address
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

  it('Should open a new session', async () => {
    const referenceSigner = ethers.Wallet.createRandom()

    const session = await Session.open({
      context: context,
      networks: networks,
      referenceSigner: referenceSigner.address,
      signers: [{ signer: referenceSigner, weight: 1 }],
      thershold: 1,
      metadata: {
        name: "Test"
      }
    })

    expect(session.account.address).to.not.equal(ethers.constants.AddressZero)
    expect(session.config.address).to.be.undefined
    expect(session.config.threshold).to.equal(1)
    expect(session.config.signers.length).to.equal(1)
    expect(session.config.signers[0].address).to.equal(referenceSigner.address.toLowerCase())
    expect(session.config.signers[0].weight).to.equal(1)

    await session.account.sendTransaction({ to: referenceSigner.address })
  })

  it("Should dump and load a session", async () => {
    const referenceSigner = ethers.Wallet.createRandom()

    const dump = (await Session.open({
      context: context,
      networks: networks,
      referenceSigner: referenceSigner.address,
      signers: [{ signer: referenceSigner, weight: 1 }],
      thershold: 1,
      metadata: {
        name: "Test"
      }
    })).dump()

    const session = Session.load({
      dump: dump,
      signers: [referenceSigner],
      networks: networks
    })

    await session.account.sendTransaction({ to: referenceSigner.address })
  })

  it("Should open an existing session", async () => {
    const referenceSigner = ethers.Wallet.createRandom()

    const ogSession = await Session.open({
      context: context,
      networks: networks,
      referenceSigner: referenceSigner.address,
      signers: [{ signer: referenceSigner, weight: 1 }],
      thershold: 1,
      metadata: {
        name: "Test"
      }
    })

    const newSigner = ethers.Wallet.createRandom()

    const session = await Session.open({
      context: context,
      networks: networks,
      referenceSigner: referenceSigner.address,
      signers: [{ signer: referenceSigner, weight: 1 }, { signer: newSigner, weight: 1 }],
      thershold: 2,
      metadata: {
        name: "Test"
      }
    })

    const [ogSignerId, signerId] = compareAddr(referenceSigner.address, newSigner.address) === 1 ? [1, 0] : [0, 1]

    expect(session.account.address.toLowerCase()).to.equal(ogSession.account.address.toLowerCase())
    expect(session.config.threshold).to.equal(2)
    expect(session.config.signers.length).to.equal(2)
    expect(session.config.signers[ogSignerId].address.toLowerCase()).to.equal(referenceSigner.address.toLowerCase())
    expect(session.config.signers[ogSignerId].weight).to.equal(1)
    expect(session.config.signers[signerId].address.toLowerCase()).to.equal(newSigner.address.toLowerCase())
    expect(session.config.signers[signerId].weight).to.equal(1)
  })

  describe('JWT Auth', () => {
    let server: mockServer.Mockttp
    let networksWithApi: NetworkConfig[]
    let fakeJwt: string
    let proofAddress: string

    beforeEach(() => {
      networksWithApi = [{
        ...networks[0],
        chaindUrl: "http://localhost:8099"
      }] as NetworkConfig[]

      fakeJwt = ethers.utils.hexlify(ethers.utils.randomBytes(64))

      server = mockServer.getLocal()
      server.start(8099)

      server.post('/rpc/ArcadeumAPI/GetAuthToken').thenCallback(async (request) => {
        const ethauth = new ETHAuth(
          ValidateSequenceDeployedContractAccountProof,
          ValidateSequenceUndeployedContractAccountProof(context)
        )

        ethauth.chainId = 31337
        ethauth.configJsonRpcProvider(ethnode.providerUrl)

        const proof = await ethauth.decodeProof(request.body.json['ewtString'])
        proofAddress = proof.address

        return {
          statusCode: 200,
          body: JSON.stringify({
            status: true,
            jwtToken: fakeJwt
          })
        }
      })
    })

    afterEach(() => {
      server.stop()
    })

    it("Should get JWT token", async () => {
      const referenceSigner = ethers.Wallet.createRandom()

      const session = await Session.open({
        context: context,
        networks: networksWithApi,
        referenceSigner: referenceSigner.address,
        signers: [{ signer: referenceSigner, weight: 1 }],
        thershold: 1,
        metadata: {
          name: "Test"
        }
      })
  
      await session.auth(31337)
      expect(session.jwts['http://localhost:8099']).to.equal(fakeJwt)
      expect(proofAddress.toLowerCase()).to.equal(session.account.address.toLowerCase())
    })

    it("Should get JWT after updating session", async () => {
      const referenceSigner = ethers.Wallet.createRandom()

      await Session.open({
        context: context,
        networks: networks,
        referenceSigner: referenceSigner.address,
        signers: [{ signer: referenceSigner, weight: 1 }],
        thershold: 1,
        metadata: {
          name: "Test"
        }
      })
  
      const newSigner = ethers.Wallet.createRandom()
  
      const session = await Session.open({
        context: context,
        networks: networksWithApi,
        referenceSigner: referenceSigner.address,
        signers: [{ signer: referenceSigner, weight: 1 }, { signer: newSigner, weight: 1 }],
        thershold: 2,
        metadata: {
          name: "Test"
        }
      })

      await session.auth(networksWithApi[0])
      expect(session.jwts['http://localhost:8099']).to.equal(fakeJwt)
      expect(proofAddress.toLowerCase()).to.equal(session.account.address.toLowerCase())
    })
  })
})
