
import { ethers, Signer } from 'ethers'
import * as Ganache from 'ganache-cli'
import { CallReceiverMock } from 'arcadeum-wallet/typings/contracts/ethers-v5/CallReceiverMock'

import { JsonRpcProvider, Provider } from '@ethersproject/providers'

import * as chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { Multicall } from '../src'
import { MulticallProvider } from '../src/providers'
import { SpyProxy } from './utils/utils'
import { getRandomInt } from '../src/utils'
import { ExternalWindowProvider, JsonRpcAsyncSender } from '../../provider/src'

const CallReceiverMockArtifact = require('wallet-contracts/artifacts/CallReceiverMock.json')
const SequenceUtilsArtifact = require('wallet-contracts/artifacts/MultiCallUtils.json')

const Web3 = require('web3')
const { expect } = chai.use(chaiAsPromised)

const GANACHE_PORT = 38545

type GanacheInstance = {
  server?: any
  serverUri?: string
  provider?: JsonRpcProvider
  spyProxy?: Provider
  signer?: Signer
  chainId?: number
}

describe('Arcadeum wallet integration', function () {
  let ganache: GanacheInstance = {}
  let provider: ethers.providers.Provider
  let brokenProvider: ethers.providers.Provider

  let callMock: CallReceiverMock

  let utilsContract: ethers.Contract

  let callCounter = 0

  before(async () => {
    // Deploy Ganache test env
    ganache.chainId = 1337
    ganache.server = Ganache.server({
      _chainIdRpc: ganache.chainId,
      _chainId: ganache.chainId,
      mnemonic: "ripple axis someone ridge uniform wrist prosper there frog rate olympic knee"
    })

    await ganache.server.listen(GANACHE_PORT)
    ganache.serverUri = `http://localhost:${GANACHE_PORT}/`
    ganache.provider = new JsonRpcProvider(ganache.serverUri)
    ganache.signer = ganache.provider.getSigner()

    utilsContract = await new ethers.ContractFactory(
      SequenceUtilsArtifact.abi,
      SequenceUtilsArtifact.bytecode,
      ganache.signer
    ).deploy()

    // Create provider
    ganache.spyProxy = SpyProxy(ganache.provider, {
      prop: 'call',
      func: ganache.provider.call,
      callback: () => { callCounter++ }
    }, {
      prop: 'getCode',
      func: ganache.provider.getCode,
      callback: () => { callCounter++ }
    })

    brokenProvider = new MulticallProvider(ganache.provider)
    callMock = await createCallMock()
  })

  async function createCallMock() {
    return ((await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      ganache.signer
    ).deploy()) as unknown) as CallReceiverMock
  }

  let options = [
    {
      name: 'MulticallProvider',
      provider: () => new MulticallProvider(
        ganache.spyProxy,
        { ...Multicall.DEFAULT_CONF, contract: utilsContract.address }
      )
    }
  ]

  beforeEach(() => {
    callCounter = 0
  })

  after(async () => {
    ganache.server.close()
  })

  options.map((option) => {
    context(option.name, () => {
      beforeEach(() => {
        provider = option.provider()
      })

      describe("Aggregate calls", async () => {
        it("Should aggregate two calls", async () => {
          await callMock.testCall(848487868126387, "0x001122")
      
          const multiCallMock = callMock.connect(provider)
          const promiseA = multiCallMock.lastValA()
          const promiseB = multiCallMock.lastValB()
      
          expect((await promiseA).toString()).to.equal("848487868126387")
          expect(await promiseB).to.equal("0x001122")
      
          expect(callCounter).to.equal(1)
        })
        it("Should aggregate three calls", async () => {
          const callMockB = await createCallMock()
      
          const randomData1 = ethers.utils.hexlify(ethers.utils.randomBytes(33))
          const randomData2 = ethers.utils.hexlify(ethers.utils.randomBytes(42))
      
          await callMock.testCall(55122, randomData1)
          await callMockB.testCall(2, randomData2)
      
          const multiCallMock = callMock.connect(provider)
          const multiCallMockB = callMockB.connect(provider)
      
          const promiseA = multiCallMock.lastValA()
      
          const [valB, valC] = await Promise.all([
            multiCallMock.lastValB(),
            multiCallMockB.lastValB()
          ])
      
          expect((await promiseA).toString()).to.equal("55122")
          expect(valB).to.equal(randomData1)
          expect(valC).to.equal(randomData2)
      
          expect(callCounter).to.equal(1)
        })
        it("Should aggregate 62 calls in two batches", async () => {
          const callMocks = await Promise.all(Array(62).fill(0).map(() => createCallMock()))
      
          const randomValues = Array(62).fill(0).map(() => ethers.utils.hexlify(ethers.utils.randomBytes(getRandomInt(0, 41))))
          await Promise.all(randomValues.map((v,i ) => callMocks[i].testCall(0, v)))
      
          const values = await Promise.all(callMocks.map((c) => c.connect(provider).lastValB()))
          values.forEach((v, i) => expect(v).to.equal(randomValues[i]))
          expect(callCounter).to.equal(2)
        })
        it("Should call eth_getCode", async () => {
          const code = await Promise.all([
            provider.getCode(callMock.address),
            provider.getCode(utilsContract.address)
          ])
      
          expect(callCounter).to.equal(1)
          const rawCode = await Promise.all([
            ganache.provider.getCode(callMock.address),
            ganache.provider.getCode(utilsContract.address)
          ])
      
          expect(rawCode[0]).to.equal(code[0])
          expect(rawCode[1]).to.equal(code[1])
        })
      })
      describe("Handle errors", async () => {
        it("Should fallback to provider if multicall fails eth_getCode", async () => {
          const code = await Promise.all([
            brokenProvider.getCode(callMock.address),
            brokenProvider.getCode(utilsContract.address)
          ])
      
          expect(callCounter).to.equal(0)
          const rawCode = await Promise.all([
            ganache.provider.getCode(callMock.address),
            ganache.provider.getCode(utilsContract.address)
          ])
      
          expect(rawCode[0]).to.equal(code[0])
          expect(rawCode[1]).to.equal(code[1])
        })
      })
    })
  })
})
