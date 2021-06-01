import { deployWalletContext } from './utils/deploy-wallet-context'

import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'

import { LocalRelayer } from '@0xsequence/relayer'
import { Wallet } from '@0xsequence/wallet'
import { WalletContext } from '@0xsequence/network'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ethers, Signer as AbstractSigner } from 'ethers'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { decodeSignature, mutateSignature, WalletConfig } from '../src'
import { encodeData } from '@0xsequence/wallet/tests/utils'
import { encodeNonce } from '@0xsequence/transactions'

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
      sequenceUtils
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
        sequenceUtils: sequenceUtils.address
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
})
