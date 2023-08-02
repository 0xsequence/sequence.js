import { ethers, providers, Signer } from 'ethers'
import * as Ganache from 'ganache'
import { CallReceiverMock } from '@0xsequence/wallet-contracts'
import { JsonRpcRouter, JsonRpcExternalProvider } from '@0xsequence/network'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { MulticallExternalProvider, multicallMiddleware, MulticallProvider } from '../src/providers'
import { SpyProxy } from './utils'
import { getRandomInt } from '@0xsequence/utils'
import { JsonRpcMethod } from '../src/constants'
import { MulticallOptions, Multicall } from '../src/multicall'

const { JsonRpcEngine } = require('json-rpc-engine')

const { providerAsMiddleware, providerFromEngine } = require('eth-json-rpc-middleware')

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const SequenceUtilsArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/utils/SequenceUtils.sol/SequenceUtils.json')

import Web3 from 'web3'
const { expect } = chai.use(chaiAsPromised)

const GANACHE_PORT = 38546

type GanacheInstance = {
  server?: any
  serverUri?: string
  provider?: providers.JsonRpcProvider
  spyProxy?: providers.JsonRpcProvider
  signer?: Signer
  chainId?: number
}

describe('Multicall integration', function () {
  const ganache: GanacheInstance = {}
  let provider: ethers.providers.Provider
  let brokenProvider: ethers.providers.Provider

  let callMock: CallReceiverMock

  let utilsContract: ethers.Contract

  let callCounter = 0
  let accounts: { account: ethers.Wallet; secretKey: string; balance: string }[]

  before(async () => {
    accounts = Array(5)
      .fill(0)
      .map(() => {
        const account = ethers.Wallet.createRandom()
        return {
          account: account,
          secretKey: account.privateKey,
          balance: ethers.utils.hexlify(ethers.utils.randomBytes(9))
        }
      })

    // Deploy Ganache test env
    ganache.chainId = 1337
    ganache.server = Ganache.server({
      chain: {
        chainId: ganache.chainId,
        networkId: ganache.chainId
      },
      mnemonic: 'ripple axis someone ridge uniform wrist prosper there frog rate olympic knee',
      accounts: accounts,
      logging: {
        verbose: false,
        debug: false,
        logger: undefined
      }
    })

    // TODO: use hardhat instead like in wallet/wallet.spec.ts

    await ganache.server.listen(GANACHE_PORT)
    ganache.serverUri = `http://127.0.0.1:${GANACHE_PORT}/`
    ganache.provider = new providers.JsonRpcProvider(ganache.serverUri)
    ganache.signer = ganache.provider.getSigner()

    utilsContract = await new ethers.ContractFactory(
      SequenceUtilsArtifact.abi,
      SequenceUtilsArtifact.bytecode,
      ganache.signer
    ).deploy(ethers.constants.AddressZero, ethers.constants.AddressZero)

    // Create provider
    ganache.spyProxy = SpyProxy(
      ganache.provider,
      {
        prop: 'call',
        func: ganache.provider.call,
        callback: () => {
          callCounter++
        }
      },
      {
        prop: 'getCode',
        func: ganache.provider.getCode,
        callback: () => {
          callCounter++
        }
      },
      {
        prop: 'getBalance',
        func: ganache.provider.getBalance,
        callback: () => {
          callCounter++
        }
      },
      {
        prop: 'send',
        func: ganache.provider.send,
        callback: (method: string, _: any[]) => {
          switch (method) {
            case JsonRpcMethod.ethCall:
            case JsonRpcMethod.ethGetCode:
            case JsonRpcMethod.ethGetBalance:
              callCounter++
          }
        }
      }
    )

    callMock = await createCallMock()
  })

  async function createCallMock() {
    return (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      ganache.signer
    ).deploy()) as unknown as CallReceiverMock
  }

  const options = [
    {
      name: 'Ether.js provider wrapper',
      provider: (options?: Partial<MulticallOptions>) => new MulticallProvider(ganache.spyProxy!, options)
    },
    {
      name: 'Json Rpc Router (Sequence)',
      provider: (options?: Partial<MulticallOptions>) =>
        new providers.Web3Provider(
          new JsonRpcRouter([multicallMiddleware(options)], new JsonRpcExternalProvider(ganache.spyProxy!))
        )
    },
    {
      name: 'Ether.js external provider wrapper',
      provider: (conf?: Partial<MulticallOptions>) =>
        new providers.Web3Provider(new MulticallExternalProvider(new JsonRpcExternalProvider(ganache.spyProxy!), conf))
    },
    {
      name: 'Provider Engine (json-rpc-engine)',
      provider: (conf?: Partial<MulticallOptions>) => {
        const engine = new JsonRpcEngine()

        engine.push(providerAsMiddleware(new MulticallExternalProvider(new JsonRpcExternalProvider(ganache.spyProxy!), conf)))

        return new ethers.providers.Web3Provider(providerFromEngine(engine))
      }
    },
    {
      name: 'Web3 external provider wrapper',
      provider: (conf?: Partial<MulticallOptions>) => {
        const web3HttpProvider = new Web3.providers.HttpProvider(ganache.serverUri!)
        const spyHttpProvider = SpyProxy(web3HttpProvider, {
          prop: 'send',
          func: web3HttpProvider.send,
          callback: (p: any) => {
            switch (p.method) {
              case JsonRpcMethod.ethCall:
              case JsonRpcMethod.ethGetCode:
              case JsonRpcMethod.ethGetBalance:
                callCounter++
            }
          }
        })
        return new providers.Web3Provider(new MulticallExternalProvider(spyHttpProvider as any, conf))
      }
    },
    {
      name: 'Ether.js provider wrapper (without proxy)',
      provider: (options?: Partial<MulticallOptions>) => new MulticallProvider(ganache.provider!, options),
      ignoreCount: true
    },
    {
      name: 'Json Rpc Router (Sequence) (without proxy)',
      provider: (options?: Partial<MulticallOptions>) =>
        new providers.Web3Provider(
          new JsonRpcRouter([multicallMiddleware(options)], new JsonRpcExternalProvider(ganache.provider!))
        ),
      ignoreCount: true
    },
    {
      name: 'Ether.js external provider wrapper (without proxy)',
      provider: (conf?: Partial<MulticallOptions>) =>
        new providers.Web3Provider(new MulticallExternalProvider(new JsonRpcExternalProvider(ganache.provider!), conf)),
      ignoreCount: true
    },
    {
      name: 'Provider Engine (json-rpc-engine) (without proxy)',
      provider: (conf?: Partial<MulticallOptions>) => {
        const engine = new JsonRpcEngine()

        engine.push(providerAsMiddleware(new MulticallExternalProvider(new JsonRpcExternalProvider(ganache.provider!), conf)))

        return new ethers.providers.Web3Provider(providerFromEngine(engine))
      },
      ignoreCount: true
    },
    {
      name: 'Web3 external provider wrapper (without proxy)',
      provider: (conf?: Partial<MulticallOptions>) => {
        const web3HttpProvider = new Web3.providers.HttpProvider(ganache.serverUri!)
        const spyHttpProvider = SpyProxy(web3HttpProvider, {
          prop: 'send',
          func: web3HttpProvider.send,
          callback: (p: any) => {
            switch (p.method) {
              case JsonRpcMethod.ethCall:
              case JsonRpcMethod.ethGetCode:
              case JsonRpcMethod.ethGetBalance:
                callCounter++
            }
          }
        })
        return new providers.Web3Provider(new MulticallExternalProvider(web3HttpProvider as any, conf))
      },
      ignoreCount: true
    }
  ]

  beforeEach(() => {
    callCounter = 0
  })

  after(async () => {
    ganache.server.close()
  })

  options.map(option => {
    context(option.name, () => {
      beforeEach(() => {
        provider = option.provider({ contract: utilsContract.address, timeWindow: 500 })
      })

      describe('Aggregate calls', async () => {
        it('Should aggregate two calls', async () => {
          await callMock.testCall(848487868126387, '0x001122')

          const multiCallMock = callMock.connect(provider)
          const promiseA = multiCallMock.lastValA()
          const promiseB = multiCallMock.lastValB()

          expect((await promiseA).toString()).to.equal('848487868126387')
          expect(await promiseB).to.equal('0x001122')

          if (option.ignoreCount) return
          expect(callCounter).to.equal(1)
        })
        it('Should aggregate three calls', async () => {
          const callMockB = await createCallMock()

          const randomData1 = ethers.utils.hexlify(ethers.utils.randomBytes(33))
          const randomData2 = ethers.utils.hexlify(ethers.utils.randomBytes(42))

          await callMock.testCall(55122, randomData1)
          await callMockB.testCall(2, randomData2)

          const multiCallMock = callMock.connect(provider)
          const multiCallMockB = callMockB.connect(provider)

          const promiseA = multiCallMock.lastValA()

          const [valB, valC] = await Promise.all([multiCallMock.lastValB(), multiCallMockB.lastValB()])

          expect((await promiseA).toString()).to.equal('55122')
          expect(valB).to.equal(randomData1)
          expect(valC).to.equal(randomData2)

          if (option.ignoreCount) return
          expect(callCounter).to.equal(1)
        })
        it('Should aggregate 62 calls in two batches', async () => {
          const callMocks = await Promise.all(
            Array(62)
              .fill(0)
              .map(() => createCallMock())
          )

          const randomValues = Array(62)
            .fill(0)
            .map(() => ethers.utils.hexlify(ethers.utils.randomBytes(getRandomInt(0, 41))))
          await Promise.all(randomValues.map((v, i) => callMocks[i].testCall(0, v)))

          const values = await Promise.all(callMocks.map(c => c.connect(provider).lastValB()))
          values.forEach((v, i) => expect(v).to.equal(randomValues[i]))

          if (option.ignoreCount) return
          expect(callCounter).to.equal(2)
        })
        it('Should aggregate in three batches :: queue > batch after first run', async () => {
          const numberOfCalls = Multicall.DefaultOptions.batchSize * 2 + 2
          const mid = numberOfCalls / 2 // Split Promise.all to not break RPC calls

          let callMocks = await Promise.all(
            Array(mid)
              .fill(0)
              .map(() => createCallMock())
          )
          callMocks = [
            ...callMocks,
            ...(await Promise.all(
              Array(mid)
                .fill(0)
                .map(() => createCallMock())
            ))
          ]

          const randomValues = Array(numberOfCalls)
            .fill(0)
            .map(() => ethers.utils.hexlify(ethers.utils.randomBytes(getRandomInt(0, 41))))
          await Promise.all(randomValues.slice(0, mid).map((v, i) => callMocks[i].testCall(0, v)))
          await Promise.all(randomValues.slice(mid).map((v, i) => callMocks[i + mid].testCall(0, v)))

          const values = await Promise.all(callMocks.map(c => c.connect(provider).lastValB()))
          values.forEach((v, i) => expect(v).to.equal(randomValues[i]))

          if (option.ignoreCount) return
          expect(callCounter).to.equal(3)
        })
        it('Should call eth_getCode', async () => {
          const code = await Promise.all([provider.getCode(callMock.address), provider.getCode(utilsContract.address)])

          if (!option.ignoreCount) expect(callCounter).to.equal(1)

          const rawCode = await Promise.all([
            ganache.provider!.getCode(callMock.address),
            ganache.provider!.getCode(utilsContract.address)
          ])

          expect(rawCode[0]).to.equal(code[0])
          expect(rawCode[1]).to.equal(code[1])
        })
        it('Should mix eth_getCode and eth_call', async () => {
          await callMock.testCall(0, '0x9952')

          const multiCallMock = callMock.connect(provider)
          const promiseA = provider.getCode(callMock.address)
          const promiseB = multiCallMock.lastValB()

          expect(await promiseA).to.equal(await ganache.provider!.getCode(callMock.address))
          expect(await promiseB).to.equal('0x9952')

          if (option.ignoreCount) return
          expect(callCounter).to.equal(1)
        })
        it('Should call eth_getBalance', async () => {
          const randomAddress = ethers.Wallet.createRandom().address

          const balances = await Promise.all([
            provider.getBalance(accounts[2].account.address),
            provider.getBalance(accounts[1].account.address),
            provider.getBalance(accounts[2].account.address),
            provider.getBalance(randomAddress)
          ])

          if (!option.ignoreCount) expect(callCounter).to.equal(1)

          // expect(callCounter).to.equal(1)
          const rawBalances = await Promise.all([
            ganache.provider!.getBalance(accounts[2].account.address),
            ganache.provider!.getBalance(accounts[1].account.address),
            ganache.provider!.getBalance(accounts[2].account.address),
            ganache.provider!.getBalance(randomAddress)
          ])

          rawBalances.forEach((bal, i) => {
            expect(balances[i].toHexString()).to.equal(bal.toHexString())
          })
        })
        it('Should call eth_getBalance and eth_getCode', async () => {
          const promiseA = provider.getCode(callMock.address)
          const promiseB = await provider.getBalance(accounts[3].account.address)

          expect(await promiseA).to.equal(await ganache.provider!.getCode(callMock.address))
          expect(promiseB.toHexString()).to.equal((await ganache.provider!.getBalance(accounts[3].account.address)).toHexString())

          if (option.ignoreCount) return
          expect(callCounter).to.equal(1)
        })
      })
      describe('Handle errors', async () => {
        it('Should not retry after failing to execute single call (not multicalled)', async () => {
          const callMockB = await createCallMock()

          await callMockB.setRevertFlag(true)

          const multiCallMockB = callMockB.connect(provider)

          // await expect(multiCallMockB.callStatic.testCall(1, "0x1122")).to.be.rejectedWith('VM Exception while processing transaction: revert CallReceiverMock#testCall: REVERT_FLAG')
          await expect(multiCallMockB.callStatic.testCall(1, '0x1122')).to.be.rejectedWith(/Transaction reverted/)

          if (option.ignoreCount) return
          expect(callCounter).to.equal(1)
        })
        it('Should retry after failing to execute using batch', async () => {
          const callMockB = await createCallMock()

          await callMockB.setRevertFlag(true)

          const multiCallMockB = callMockB.connect(provider)

          // await expect(Promise.all([
          //   multiCallMockB.callStatic.testCall(1, "0x1122"),
          //   multiCallMockB.callStatic.testCall(2, "0x1122")
          // ])).to.be.rejectedWith('VM Exception while processing transaction: revert CallReceiverMock#testCall: REVERT_FLAG')
          await expect(
            Promise.all([multiCallMockB.callStatic.testCall(1, '0x1122'), multiCallMockB.callStatic.testCall(2, '0x1122')])
          ).to.be.rejectedWith(/Transaction reverted/)

          if (option.ignoreCount) return
          expect(callCounter).to.equal(3)
        })

        it('Should call getStorageAt', async () => {
          const random = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          await callMock.testCall(random, '0x00')
          const storageAt = ethers.utils.hexZeroPad(await provider.getStorageAt(callMock.address, 0), 32)
          expect(storageAt).to.equal(ethers.utils.defaultAbiCoder.encode(['bytes32'], [random]))
        })

        it('Should call getStorageAt with padding', async () => {
          const val = '0x001a6077bf4f6eae0b4d9158b68bc770c97e5ef19efffcfa28aec2bce13cae24'
          await callMock.testCall(val, '0x00')
          const storageAt = ethers.utils.hexZeroPad(await provider.getStorageAt(callMock.address, 0), 32)
          expect(storageAt).to.equal(ethers.utils.defaultAbiCoder.encode(['bytes32'], [val]))
        })

        it('Should detect network', async () => {
          const net = await (provider as ethers.providers.BaseProvider).detectNetwork()
          expect(net.chainId).to.equal(1337)
        })

        // TODO: fix this test, its breaking on macOS node v15.12.0
        /*it("Should execute batch with errors on it", async () => {
          const callMockB = await createCallMock()

          callMockB.testCall(1, "0x1122")

          await callMockB.setRevertFlag(true)

          const multiCallMockB = callMockB.connect(provider)

          const errorPromise = multiCallMockB.callStatic.testCall(1, "0x1122")

          const res = await Promise.all([
            provider.getCode(multiCallMockB.address),
            multiCallMockB.lastValB()
          ])

          await expect(errorPromise).to.be.rejected

          expect(res[0].length).to.not.equal(0)
          expect(res[1]).to.equal("0x1122")
          expect(callCounter).to.equal(2)
        })*/

        const brokenProviderOptions = [
          {
            name: 'non-deployed util contract',
            overhead: 0,
            brokenProvider: (getProvider: (options?: Partial<MulticallOptions>) => providers.Provider) =>
              getProvider({
                contract: ''
              })
          },
          {
            name: 'EOA address as util contract',
            overhead: 1,
            brokenProvider: (getProvider: (options?: Partial<MulticallOptions>) => providers.Provider) =>
              getProvider({
                contract: ethers.Wallet.createRandom().address
              })
          },
          {
            name: 'Broken contract as util contract',
            overhead: 1,
            brokenProvider: (getProvider: (options?: Partial<MulticallOptions>) => providers.Provider) =>
              getProvider({
                contract: callMock.address
              })
          },
          {
            name: 'invalid address as util contract',
            overhead: 0,
            brokenProvider: (getProvider: (options?: Partial<MulticallOptions>) => providers.Provider) =>
              getProvider({
                contract: 'This is not a valid address'
              })
          }
        ]

        brokenProviderOptions.map(brokenOption =>
          context(brokenOption.name, () => {
            beforeEach(() => {
              brokenProvider = brokenOption.brokenProvider(option.provider)
            })

            it('Should fallback to provider if multicall fails eth_getCode', async () => {
              const code = await Promise.all([
                brokenProvider.getCode(callMock.address),
                brokenProvider.getCode(utilsContract.address)
              ])

              if (!option.ignoreCount) expect(callCounter).to.equal(2 + brokenOption.overhead)
              const rawCode = await Promise.all([
                ganache.provider!.getCode(callMock.address),
                ganache.provider!.getCode(utilsContract.address)
              ])

              expect(rawCode[0]).to.equal(code[0])
              expect(rawCode[1]).to.equal(code[1])
            })

            it('Should fallback to provider if multicall fails eth_call', async () => {
              await callMock.testCall(848487868126387, '0x001122')

              const multiCallMock = callMock.connect(brokenProvider)
              const promiseA = multiCallMock.lastValA()
              const promiseB = multiCallMock.lastValB()

              expect((await promiseA).toString()).to.equal('848487868126387')
              expect(await promiseB).to.equal('0x001122')

              if (option.ignoreCount) return
              expect(callCounter).to.equal(3)
            })

            it('Should fallback to provider if multicall fails eth_call and eth_getCode', async () => {
              await callMock.testCall(848487868126387, '0x001122')

              const multiCallMock = callMock.connect(brokenProvider)
              const promiseA = multiCallMock.lastValA()
              const promiseB = multiCallMock.lastValB()
              const promiseC = brokenProvider.getCode(callMock.address)

              expect((await promiseA).toString()).to.equal('848487868126387')
              expect(await promiseB).to.equal('0x001122')
              expect(await promiseC).to.equal(await provider.getCode(callMock.address))

              if (option.ignoreCount) return
              expect(callCounter).to.equal(4 + brokenOption.overhead)
            })

            it('Should fallback to provider if multicall fails eth_getBalance', async () => {
              const randomAddress = ethers.Wallet.createRandom().address

              const balances = await Promise.all([
                brokenProvider.getBalance(accounts[2].account.address),
                brokenProvider.getBalance(accounts[1].account.address),
                brokenProvider.getBalance(accounts[2].account.address),
                brokenProvider.getBalance(randomAddress)
              ])

              if (!option.ignoreCount) expect(callCounter).to.equal(4 + brokenOption.overhead)

              // expect(callCounter).to.equal(1)
              const rawBalances = await Promise.all([
                ganache.provider!.getBalance(accounts[2].account.address),
                ganache.provider!.getBalance(accounts[1].account.address),
                ganache.provider!.getBalance(accounts[2].account.address),
                ganache.provider!.getBalance(randomAddress)
              ])

              rawBalances.forEach((bal, i) => {
                expect(balances[i].toHexString()).to.equal(bal.toHexString())
              })
            })

            it('Should fallback to provider if multicall fails eth_getBalance and eth_getCode', async () => {
              const promiseA = brokenProvider.getCode(callMock.address)
              const promiseB = await brokenProvider.getBalance(accounts[3].account.address)

              expect(await promiseA).to.equal(await ganache.provider!.getCode(callMock.address))
              expect(promiseB.toHexString()).to.equal(
                (await ganache.provider!.getBalance(accounts[3].account.address)).toHexString()
              )

              if (option.ignoreCount) return
              expect(callCounter).to.equal(2 + brokenOption.overhead)
            })
          })
        )
      })
    })
  })
})
