import { deployWalletContext } from './utils/deploy-wallet-context'

import { CallReceiverMock, HookCallerMock } from '@0xsequence/wallet-contracts'

import { LocalRelayer } from '@0xsequence/relayer'
import { Wallet } from '@0xsequence/wallet'
import { WalletContext } from '@0xsequence/network'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ethers, Signer as AbstractSigner } from 'ethers'

import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import { imageHash, SequenceUtilsFinder, sortConfig, WalletConfig } from '../src'
import { getCachedConfig } from '../src/cache'

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

describe('Wallet integration', function () {
  let ethnode: EthereumInstance[] = []

  let authChain: EthereumInstance
  let mainChain: EthereumInstance

  let context: WalletContext

  before(async () => {
    const nodeA = "http://localhost:7547/"
    const providerA = new ethers.providers.JsonRpcProvider(nodeA)
    const signerA = providerA.getSigner()

    const nodeB = "http://localhost:7548/"
    const providerB = new ethers.providers.JsonRpcProvider(nodeB)
    const signerB = providerB.getSigner()

    // Create network instances
    ethnode = [{
      providerUrl: nodeA,
      chainId: 31337,
      provider: providerA,
      signer: signerA
    }, {
      providerUrl: nodeB,
      chainId: 31337,
      provider: providerB,
      signer: signerB
    }]

    authChain = ethnode[0]
    mainChain = ethnode[1]

    // Deploy local relayer
    await Promise.all(ethnode.map(async (en) => {
      en.relayer = new LocalRelayer(en.signer)

      // Deploy Sequence env
      const [
        factory,
        mainModule,
        mainModuleUpgradable,
        guestModule,
        sequenceUtils,
        requireFreshSigner
      ] = await deployWalletContext(en.provider)

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
      en.callReceiver = (await new ethers.ContractFactory(
        CallReceiverMockArtifact.abi,
        CallReceiverMockArtifact.bytecode,
        en.signer
      ).deploy()) as CallReceiverMock

      // Deploy hook caller mock
      en.hookCaller = (await new ethers.ContractFactory(
        HookCallerMockArtifact.abi,
        HookCallerMockArtifact.bytecode,
        en.signer
      ).deploy()) as HookCallerMock
    }))
  })

  describe('Retrieve configuration', () => {
    it('Find counterfactual wallet using known configs', async () => {
      const wallet = await Wallet.singleOwner(ethers.Wallet.createRandom(), context)
      const finder = new SequenceUtilsFinder(authChain.provider)

      const found = await finder.findCurrentConfig(
        { address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            wallet.config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config
          ]
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(wallet.config))
    })
    it('Fail to find counterfactual wallet without known configs', async () => {
      const wallet = await Wallet.singleOwner(ethers.Wallet.createRandom(), context)
      const finder = new SequenceUtilsFinder(authChain.provider)

      const found = await finder.findCurrentConfig(
        { address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config
          ]
        }
      )

      expect(found.config).to.be.undefined
    })
    it('Find counterfactual wallet after deployment', async () => {
      const wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: ethers.Wallet.createRandom().address }, { weight: 1, address: ethers.Wallet.createRandom().address }] }})
      const finder = new SequenceUtilsFinder(authChain.provider)

      await mainChain.relayer.deployWallet(wallet.config, wallet.context)

      const found = await finder.findCurrentConfig(
        { address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            wallet.config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config
          ]
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(wallet.config))
    })
    it('Find counterfactual wallet after deployment on authChain', async () => {
      const wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: ethers.Wallet.createRandom().address }, { weight: 1, address: ethers.Wallet.createRandom().address }] }})
      const finder = new SequenceUtilsFinder(authChain.provider)

      await authChain.relayer.deployWallet(wallet.config, wallet.context)

      const found = await finder.findCurrentConfig(
        { address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            wallet.config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config
          ]
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(wallet.config))
    })
    it('Find counterfactual wallet after deployment and update on authChain (indexed)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)
      const finder = new SequenceUtilsFinder(authChain.provider)

      const newConfig = { threshold: 1, signers: [{ weight: 2, address: ethers.Wallet.createRandom().address }] }
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.publishConfig(true)
      await wallet.updateConfig(newConfig, undefined, true, true)

      const found = await finder.findCurrentConfig(
        { address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config
          ]
        }
      )

      expect(found).to.not.be.undefined
      expect(imageHash(found.config)).to.equal(imageHash(wallet.config))
    })
    it('Find counterfactual wallet after deployment and update on authChain (not-indexed)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)
      const finder = new SequenceUtilsFinder(authChain.provider)

      const newConfig = { threshold: 1, signers: [{ weight: 2, address: ethers.Wallet.createRandom().address }] }
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.publishConfig(false)
      await wallet.updateConfig(newConfig, undefined, true, false)

      const found = await finder.findCurrentConfig(
        { address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config
          ]
        }
      )

      expect(found?.config).to.not.be.undefined
      expect(imageHash(found.config)).to.equal(imageHash(wallet.config))
    })
    it('Fail to find counterfactual wallet after deployment and update on authChain if og config is not published', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)
      const finder = new SequenceUtilsFinder(authChain.provider)

      const newConfig = { threshold: 1, signers: [{ weight: 2, address: ethers.Wallet.createRandom().address }] }
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.updateConfig(newConfig, undefined, true, false)

      const found = await finder.findCurrentConfig(
        { address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config,
            (await Wallet.singleOwner(ethers.Wallet.createRandom())).config
          ]
        }
      )

      expect(found.config).to.be.undefined
    })
    it('Find wallet configuration after update on both chains (indexed)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)

      const finder = new SequenceUtilsFinder(authChain.provider)

      await authChain.relayer.deployWallet(wallet.config, wallet.context)
      await mainChain.relayer.deployWallet(wallet.config, wallet.context)

      const newConfig = { threshold: 1, signers: [{ weight: 2, address: ethers.Wallet.createRandom().address }] }

      await wallet.connect(mainChain.provider, mainChain.relayer).updateConfig(newConfig)
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.updateConfig(newConfig, undefined, true, true)

      const found = await finder.findCurrentConfig(
        {
          address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(newConfig))
    })
    it('Find wallet configuration after update on both chains (not-indexed)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)

      const finder = new SequenceUtilsFinder(authChain.provider)

      await authChain.relayer.deployWallet(wallet.config, wallet.context)
      await mainChain.relayer.deployWallet(wallet.config, wallet.context)

      const newConfig = { threshold: 1, signers: [{ weight: 2, address: ethers.Wallet.createRandom().address }] }

      await wallet.connect(mainChain.provider, mainChain.relayer).updateConfig(newConfig)
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.updateConfig(newConfig, undefined, true, false)

      const found = await finder.findCurrentConfig(
        {
          address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(newConfig))
    })
    it('Fail to find wallet configuration after update on both chains (not-published)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)

      const finder = new SequenceUtilsFinder(authChain.provider)

      await authChain.relayer.deployWallet(wallet.config, wallet.context)
      await mainChain.relayer.deployWallet(wallet.config, wallet.context)

      const newConfig = { threshold: 1, signers: [{ weight: 2, address: ethers.Wallet.createRandom().address }] }

      await wallet.connect(mainChain.provider, mainChain.relayer).updateConfig(newConfig)
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.updateConfig(newConfig)

      const found = await finder.findCurrentConfig(
        {
          address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          skipCache: true
        }
      )

      expect(found.config).to.be.undefined
    })
    it('Find wallet configuration after asymetric update on both chains (indexed)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)

      const finder = new SequenceUtilsFinder(authChain.provider)

      const newConfigA = { threshold: 1, signers: [{ weight: 2, address: signer1.address }] }
      const newConfigB = { threshold: 1, signers: [{ weight: 2, address: signer2.address }] }

      // Update wallet on mainChain to newConfigA
      await wallet.connect(mainChain.provider, mainChain.relayer).updateConfig(newConfigA)

      // Update wallet on authChain to newConfigB
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.publishConfig(true)
      await wallet.updateConfig(newConfigA, undefined, true, true)

      const updatedWallet = new Wallet({ context, config: { address: wallet.address, ...newConfigA } }, signer1).connect(authChain.provider, authChain.relayer)
      await updatedWallet.updateConfig(newConfigB, undefined, true, true)

      // Get config on mainChain
      const found = await finder.findCurrentConfig(
        {
          address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(newConfigA))
    })
    it('Find wallet configuration after asymetric update on both chains (not-indexed)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)

      const finder = new SequenceUtilsFinder(authChain.provider)

      const newConfigA = { threshold: 1, signers: [{ weight: 2, address: signer1.address }] }
      const newConfigB = { threshold: 1, signers: [{ weight: 2, address: signer2.address }] }

      // Update wallet on mainChain to newConfigA
      await wallet.connect(mainChain.provider, mainChain.relayer).updateConfig(newConfigA)

      // Update wallet on authChain to newConfigB
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.publishConfig(true)
      await wallet.updateConfig(newConfigA, undefined, true, true)

      const updatedWallet = new Wallet({ context, config: { address: wallet.address, ...newConfigA } }, signer1).connect(authChain.provider, authChain.relayer)
      await updatedWallet.updateConfig(newConfigB, undefined, true, true)

      // Get config on mainChain
      const found = await finder.findCurrentConfig(
        {
          address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(newConfigA))
    })
    it('Find wallet configuration after asymetric update on both chains (not published, from known configs)', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)

      const finder = new SequenceUtilsFinder(authChain.provider)

      const newConfigA = { threshold: 1, signers: [{ weight: 2, address: signer1.address }] }
      const newConfigB = { threshold: 1, signers: [{ weight: 2, address: signer2.address }] }

      // Update wallet on mainChain to newConfigA
      await wallet.connect(mainChain.provider, mainChain.relayer).updateConfig(newConfigA)

      // Update wallet on authChain to newConfigB
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.publishConfig(true)
      await wallet.updateConfig(newConfigA)

      const updatedWallet = new Wallet({ context, config: { address: wallet.address, ...newConfigA } }, signer1).connect(authChain.provider, authChain.relayer)
      await updatedWallet.updateConfig(newConfigB, undefined, true, true)

      // Get config on mainChain
      const found = await finder.findCurrentConfig(
        {
          address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          knownConfigs: [
            newConfigA,
            newConfigA,
            { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }
          ]
        }
      )

      expect(imageHash(found.config)).to.equal(imageHash(newConfigA))
    })
    it('Fail to find wallet configuration after asymetric update on both chains if config is not published', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      let wallet = new Wallet({ context, config: { threshold: 2, signers: [{ weight: 3, address: signer1.address }, { weight: 1, address: signer2.address }] }}, signer1, signer2)

      const finder = new SequenceUtilsFinder(authChain.provider)

      const newConfigA = { threshold: 1, signers: [{ weight: 2, address: signer1.address }] }
      const newConfigB = { threshold: 1, signers: [{ weight: 2, address: signer2.address }] }

      // Update wallet on mainChain to newConfigA
      await wallet.connect(mainChain.provider, mainChain.relayer).updateConfig(newConfigA)

      // Update wallet on authChain to newConfigB
      wallet = wallet.connect(authChain.provider, authChain.relayer)
      await wallet.publishConfig(true)
      await wallet.updateConfig(newConfigA)

      const updatedWallet = new Wallet({ context, config: { address: wallet.address, ...newConfigA } }, signer1).connect(authChain.provider, authChain.relayer)
      await updatedWallet.updateConfig(newConfigB, undefined, true, true)

      // Get config on mainChain
      const found = await finder.findCurrentConfig(
        {
          address: wallet.address,
          provider: mainChain.provider,
          context: wallet.context,
          skipCache: true
        }
      )

      expect(found.config).to.be.undefined
    })
    it('Cache wallet configuration after instantiation or update', async () => {
      // non-caching version of imageHash for testing
      const imageHash = (config: WalletConfig): string => {
        return sortConfig(config).signers.reduce(
          (imageHash, signer) => ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
              ['bytes32', 'uint8', 'address'],
              [imageHash, signer.weight, signer.address]
            )
          ),
          ethers.utils.solidityPack(['uint256'], [config.threshold])
        )
      }

      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      const signer3 = ethers.Wallet.createRandom()

      const initialConfig = {
        threshold: 1,
        signers: [
          { weight: 1, address: signer1.address }
        ]
      }

      const nextConfig = {
        threshold: 2,
        signers: [
          { weight: 1, address: signer1.address },
          { weight: 1, address: signer2.address }
        ]
      }

      const finalConfig = {
        threshold: 3,
        signers: [
          { weight: 1, address: signer1.address },
          { weight: 1, address: signer2.address },
          { weight: 1, address: signer3.address }
        ]
      }

      // none of these configs are cached
      expect(getCachedConfig(imageHash(initialConfig))).to.be.undefined
      expect(getCachedConfig(imageHash(nextConfig))).to.be.undefined
      expect(getCachedConfig(imageHash(finalConfig))).to.be.undefined

      // create wallet with initialConfig
      let wallet = new Wallet({ context, config: initialConfig }, signer1)
      wallet = wallet.connect(authChain.provider, authChain.relayer)

      // only initialConfig should be cached
      expect(getCachedConfig(imageHash(initialConfig))).to.not.be.undefined
      expect(getCachedConfig(imageHash(nextConfig))).to.be.undefined
      expect(getCachedConfig(imageHash(finalConfig))).to.be.undefined

      // update config to nextConfig
      await wallet.publishConfig(true)
      await wallet.updateConfig(nextConfig)

      // now nextConfig should also be cached
      expect(getCachedConfig(imageHash(initialConfig))).to.not.be.undefined
      expect(getCachedConfig(imageHash(nextConfig))).to.not.be.undefined
      expect(getCachedConfig(imageHash(finalConfig))).to.be.undefined

      // Wallet.useConfig should also cache
      wallet = wallet.useConfig(finalConfig)

      // finally finalConfig should be cached
      expect(getCachedConfig(imageHash(initialConfig))).to.not.be.undefined
      expect(getCachedConfig(imageHash(nextConfig))).to.not.be.undefined
      expect(getCachedConfig(imageHash(finalConfig))).to.not.be.undefined
    })
  })
})
