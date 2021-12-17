import { deployWalletContext } from './utils/deploy-wallet-context'

import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'

import { LocalRelayer } from '@0xsequence/relayer'
import { Wallet } from '@0xsequence/wallet'
import { WalletContext } from '@0xsequence/network'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ethers, Signer as AbstractSigner } from 'ethers'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { buildStubSignature, decodeSignature, isDecodedEOASigner, isDecodedSigner, mutateSignature, WalletConfig } from '../src'
import { encodeData } from '@0xsequence/wallet/tests/utils'
import { encodeNonce } from '@0xsequence/transactions'
import { encodeSignature, isDecodedAddress, isDecodedFullSigner } from '../dist/0xsequence-config.cjs'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')
const HookCallerMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/HookCallerMock.sol/HookCallerMock.json')

const { expect } = chai.use(chaiAsPromised)


type EthereumInstance = {
  chainId: number
  providerUrl: string
  provider: JsonRpcProvider
  signer: AbstractSigner
  relayer?: LocalRelayer
  callReceiver?: CallReceiverMock
  hookCaller?: HookCallerMock
}

describe('Signature tools', function () {
  let chain: EthereumInstance

  let context: WalletContext

  before(async () => {
    const nodeA = "http://localhost:7547/"
    const providerA = new ethers.providers.JsonRpcProvider(nodeA)
    const signerA = providerA.getSigner()

    chain = {
      providerUrl: nodeA,
      chainId: 31337,
      provider: providerA,
      signer: signerA
    }

    // Deploy local relayer
    chain.relayer = new LocalRelayer(chain.signer)

    // Deploy Sequence env
    const [
      factory,
      mainModule,
      mainModuleUpgradable,
      guestModule,
      sequenceUtils,
      requireFreshSigner
    ] = await deployWalletContext(chain.provider)

    if (context) {
      expect(context.factory).to.equal(factory.address)
      expect(context.mainModule).to.equal(mainModule.address)
      expect(context.mainModuleUpgradable).to.equal(mainModuleUpgradable.address)
      expect(context.guestModule).to.equal(guestModule.address)
      expect(context.sequenceUtils).to.equal(sequenceUtils.address)
    } else {
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
    }

    // Deploy call receiver mock
    chain.callReceiver = (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      chain.signer
    ).deploy()) as CallReceiverMock

    // Deploy hook caller mock
    chain.hookCaller = (await new ethers.ContractFactory(
      HookCallerMockArtifact.abi,
      HookCallerMockArtifact.bytecode,
      chain.signer
    ).deploy()) as HookCallerMock
  })

  describe("Change signature configuration", () => {
    [{
      name: "same as old configuration",
      getNewConfig: ((config: WalletConfig) => {
        return config
      }),
    }, {
      name: "with an extra signer",
      getNewConfig: ((config: WalletConfig) => {
        return { threshold: config.threshold, signers: [
          ...config.signers,
          {
            address: ethers.Wallet.createRandom().address,
            weight: 2
          }
        ]}
      }),
    }, {
      name: "with one less signer",
      getNewConfig: ((config: WalletConfig) => {
        return { threshold: config.threshold, signers: [
          config.signers[0]
        ]}
      }),
    }, {
      name: "with higher weights",
      getNewConfig: ((config: WalletConfig) => {
        return { threshold: config.threshold, signers: config.signers.map((s) => {
          return { ...s, weight: 4 }
        })}
      }),
    }, {
      name: "with lower weights",
      getNewConfig: ((config: WalletConfig) => {
        return { threshold: config.threshold, signers: config.signers.map((s) => {
          return { ...s, weight: 4 }
        })}
      }),
    }, {
      name: "with lower threshold",
      getNewConfig: ((config: WalletConfig) => {
        return { threshold: 1, signers: config.signers }
      }),
    }, {
      name: "with higher threshold",
      getNewConfig: ((config: WalletConfig) => {
        return { threshold: 1, signers: config.signers }
      }),
    }].map((c) => it(`Should mutate signature after ${c.name}`, async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      const config: WalletConfig = {
        threshold: 2,
        signers: [{
          address: signer1.address,
          weight: 2
        }, {
          address: signer2.address,
          weight: 3
        }]
      }

      const newConfig = c.getNewConfig(config)

      const wallet = new Wallet({ config, context }, signer1, signer2).connect(chain.provider, chain.relayer)
      const data = ethers.utils.hexlify(ethers.utils.randomBytes(32))

      const transaction = {
        gasLimit: '121000',
        to: chain.callReceiver.address,
        value: 0,
        data: await encodeData(chain.callReceiver, "testCall", 1, data),
        delegateCall: false,
        revertOnError: true,
        nonce: encodeNonce(Date.now(), 0)
      }

      const ogSig = await wallet.signTransactions(transaction)
      const subDigest = await wallet.subDigest(ogSig.digest)

      const oldSignature = decodeSignature(await ogSig.signature)

      await wallet.updateConfig(newConfig, undefined, false)

      const newSig = mutateSignature(oldSignature, newConfig, subDigest)
      await wallet.sendSignedTransactions({ ...ogSig, signature: newSig })

      expect(await chain.callReceiver.lastValB()).to.equal(data)
    }))
  })

  describe("Should generate stub signatures", async () => {
    it("Should generate stub signature for a simple wallet", async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      const config: WalletConfig = {
        threshold: 2,
        signers: [{
          address: signer1.address,
          weight: 2
        }, {
          address: signer2.address,
          weight: 3
        }]
      }

      const stub = await buildStubSignature(chain.provider, config)
      expect(stub.signers.length).to.equal(2)
      expect(stub.threshold).to.equal(2)
      expect(stub.signers.find((s) => isDecodedAddress(s)).weight).to.equal(3)
      expect(stub.signers.find((s) => isDecodedEOASigner(s)).weight).to.equal(2)
    })

    it("Should generate stub signature with 4 signers with lower weight", async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      const signer3 = ethers.Wallet.createRandom()
      const signer4 = ethers.Wallet.createRandom()
      const signer5 = ethers.Wallet.createRandom()
      const signer6 = ethers.Wallet.createRandom()

      const config: WalletConfig = {
        threshold: 5,
        signers: [{
          address: signer1.address,
          weight: 1
        }, {
          address: signer2.address,
          weight: 1
        }, {
          address: signer3.address,
          weight: 15
        }, {
          address: signer4.address,
          weight: 1
        }, {
          address: signer5.address,
          weight: 3
        }, {
          address: signer6.address,
          weight: 2
        }]
      }

      const stub = await buildStubSignature(chain.provider, config)

      expect(stub.signers.length).to.equal(6)
      expect(stub.threshold).to.equal(5)
      expect(stub.signers.filter((s) => isDecodedAddress(s)).length).to.equal(2)
      expect(stub.signers.filter((s) => isDecodedEOASigner(s)).length).to.equal(4)
      expect(stub.signers.filter((s) => isDecodedAddress(s)).map((s: any) => s.address)).to.deep.equal([signer3.address, signer5.address])
      expect(stub.signers.filter((s) => isDecodedEOASigner(s)).map((s) => s.weight)).to.deep.equal([1, 1, 1, 2])
    })

    it("Should generate signature with nested configuration", async () => {
      const signer1 = ethers.Wallet.createRandom().address
      const signer2 = ethers.Wallet.createRandom().address
      const signer3 = context.guestModule

      const config: WalletConfig = {
        threshold: 16,
        signers: [{
          address: signer1,
          weight: 1
        }, {
          address: signer2,
          weight: 2
        }, {
          address: signer3,
          weight: 15
        }]
      }

      const stub = await buildStubSignature(chain.provider, config)

      const stubSig = ethers.utils.arrayify("0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a01b02")

      expect(stub.signers.length).to.equal(3)
      expect(stub.threshold).to.equal(16)
      expect(stub.signers.filter((s) => isDecodedAddress(s)).length).to.equal(1)
      expect(stub.signers.filter((s) => isDecodedEOASigner(s)).length).to.equal(1)
      expect(stub.signers.filter((s) => isDecodedFullSigner(s)).length).to.equal(1)
      expect((stub.signers.find((s) => isDecodedFullSigner(s)) as any).address).to.equal(signer3)
      expect(stub.signers.find((s) => isDecodedAddress(s)).weight).to.equal(2)
      expect((stub.signers.find((s) => isDecodedFullSigner(s)) as any).signature.length).to.equal(
        (encodeSignature({
          threshold: 1,
          signers: [
            {
              address: ethers.Wallet.createRandom().address,
              weight: 1,
            },
            {
              weight: 1,
              signature: stubSig
            }
          ]
        }) + '03').length
      )
    })
  })
})
