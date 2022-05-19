import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import chaiExclude from 'chai-exclude'

import { ethers, Transaction, Wallet } from 'ethers'
import hardhat from 'hardhat'
import { WalletContext, NetworkConfig } from '@0xsequence/network'
import { LocalRelayer, RpcRelayer } from '@0xsequence/relayer'
import { deployWalletContext } from './utils/deploy-wallet-context'
import { imageHash, LocalConfigTracker, ConfigTracker, UntrustedConfigTracker, decodeSignature, DebugConfigTracker, RedundantConfigTracker } from '@0xsequence/config'
import { configureLogger } from '@0xsequence/utils'

import * as lib from '../src'
import { addressOf, sortConfig, WalletConfig } from '../../config/src/config'
import { encodeNonce } from '@0xsequence/transactions'
import { CallReceiverMock } from '@0xsequence/wallet-contracts'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')

const { expect } = chai.use(chaiAsPromised)
chai.use(chaiExclude)

configureLogger({ logLevel: 'DEBUG', silence: false })

describe('Account integration', () => {
  let context: WalletContext
  let account: lib.Account
  let owner: ethers.Wallet
  let configTracker: ConfigTracker
  let callReceiver: CallReceiverMock

  let config: WalletConfig

  const provider = new ethers.providers.Web3Provider(hardhat.network.provider.send)

  const nodeB = 'http://localhost:7047/'
  const providerB = new ethers.providers.JsonRpcProvider(nodeB)
  const signerB = providerB.getSigner()

  const networks: NetworkConfig[] = [
    {
      chainId: 31337,
      name: 'hardhat',
      rpcUrl: '',
      provider: provider,
      relayer: new LocalRelayer({ signer: provider.getSigner() }),
      isDefaultChain: true,
    },
    {
      chainId: 31338,
      name: 'hardhat2',
      rpcUrl: nodeB,
      provider: providerB,
      relayer: new LocalRelayer({ signer: signerB }),
      isDefaultChain: false,
    }
  ]

  before(async () => {
    // Deploy Sequence context
    const [
      factory,
      mainModule,
      mainModuleUpgradable,
      guestModule,
      sequenceUtils,
      requireFreshSigner,
      sessionUtils
    ] = await deployWalletContext(
      provider.getSigner()
    )

    // Deploy Sequence context b
    await deployWalletContext(signerB)

    // Create fixed context obj
    context = {
      factory: factory.address,
      mainModule: mainModule.address,
      mainModuleUpgradable: mainModuleUpgradable.address,
      guestModule: guestModule.address,
      sequenceUtils: sequenceUtils.address,
      sessionUtils: sessionUtils.address,
      libs: {
        requireFreshSigner: requireFreshSigner.address
      }
    }

    // Deploy call receiver mock
    callReceiver = (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      networks[0].provider.getSigner()
    ).deploy()) as CallReceiverMock

    // Create in-memory config tracker
    configTracker = new LocalConfigTracker(undefined, context)
    
    // We do trust the config tracker
    // but we wrap it anyway to test the untrusted wrapper
    configTracker = new UntrustedConfigTracker(configTracker, context)

    // Create another local config tracker parallel to the first one
    // to the redundant config tracker
    const configTracker2 = new LocalConfigTracker(undefined, context)
    configTracker = new RedundantConfigTracker([configTracker, configTracker2])

    // Wrap redundant config tracker on untrusted again
    // to further test the quality of it
    configTracker = new UntrustedConfigTracker(configTracker, context)
  })

  beforeEach(async () => {
    // Create account
    owner = ethers.Wallet.createRandom()
    const wallet = await lib.Wallet.singleOwner(owner, context)

    config = wallet.config
    configTracker.saveWalletConfig({ config })
    configTracker.saveCounterFactualWallet({ context, imageHash: imageHash(config) })

    account = new lib.Account(
      {
        address: wallet.address,
        networks,
        context,
        configTracker
      },
      owner
    )
  })

  describe('update', () => {
    it('should settle configuration update after next transaction', async () => {
      // Force account to deploy wallet
      await account.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [0, []])
      })

      // Generate new config and update account
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 10 }, { address: owner.address, weight: 1 }] }

      // Sort new config
      const sorted = sortConfig(newConfig)

      await account.updateConfig(sorted, networks[0])
      await account.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [5991232, []])
      })

      // Get state, wallet should be deployed and published
      expect(await account.getWalletConfig()).excluding('address').to.deep.equal(newConfig)

      const state = await account.getWalletState()
      expect(state.published).to.be.true

      expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(5991232))
    })

    it('should settle unsorted configuration update after next transaction', async () => {
      // Force account to deploy wallet
      await account.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [0, []])
      })

      // Generate new config and update account
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 10 }, { address: owner.address, weight: 1 }] }

      // Sort new config, but in reverse!
      const sorted = sortConfig(newConfig)
      const unsorted = { ...sorted, signers: sorted.signers.reverse() }

      await account.updateConfig(unsorted, networks[0])
      await account.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [5991232, []])
      })

      // Get state, wallet should be deployed and published
      expect(await account.getWalletConfig()).excluding('address').to.deep.equal(newConfig)

      const state = await account.getWalletState()
      expect(state.published).to.be.true

      expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(5991232))
    })

    it('should import and settle configuration update after next transaction', async () => {
      // Force account to deploy wallet
      await account.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [0, []])
      })

      // Generate new config and update account
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 10 }, { address: owner.address, weight: 1 }] }

      await account.updateConfig(newConfig, networks[0])

      // re-import account
      const account2 = new lib.Account({ address: account.address, configTracker, networks, context }, newSigner)

      await account2.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [4293882, []])
      })

      // Get state, wallet should be deployed and published
      expect(await account2.getWalletConfig()).excluding('address').to.deep.equal(newConfig)

      const state = await account.getWalletState()
      expect(state.published).to.be.true

      expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(4293882))
    })

    it('should import, deploy and settle configuration after next transaction', async () => {
      // Generate new signer
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 10 }] }

      // Update account to new config
      await account.updateConfig(newConfig, networks[0])

      // re-import account
      const account2 = new lib.Account({address: account.address, configTracker, networks, context }, newSigner)

      // Send transaction, should deploy + update wallet
      await account2.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [111, []])
      })

      // Should be deployed, published and callReceiver updated
      const state = await account2.getWalletState()
      expect(state.published).to.be.true
      expect(state.deployed).to.be.true
      expect(state.config).excluding('address').to.deep.equal(newConfig)
      expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(111))
    })

    it('should chain 3 wallet updates', async () => {
      // Generate new signer
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 1 }] }

      // Update account to new config
      await account.updateConfig(newConfig, networks[0])

      // Generate another new config
      const newSigner2 = ethers.Wallet.createRandom()
      const newConfig2 = { threshold: 2, signers: [{ address: newSigner2.address, weight: 2 }] }

      // // Update account to new config
      await account.useSigners(newSigner).updateConfig(newConfig2, networks[0].chainId)
  
      // Generate one last new config
      const newSigner3 = ethers.Wallet.createRandom()
      const newConfig3 = { threshold: 3, signers: [{ address: newSigner3.address, weight: 99 }] }
  
      // Update account one last time
      await account.useSigners(newSigner2).updateConfig(newConfig3, networks[0].chainId)

      // Send a transaction, it should deploy + update wallet
      await account.useSigners(newSigner3).sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [222, []])
      })

      // Should be deployed, published and callReceiver updated
      const state = await account.getWalletState()
      expect(state.published).to.be.true
      expect(state.deployed).to.be.true
      expect(state.config).excluding('address').to.deep.equal(newConfig3)
      expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(222))
    })

    it('should store high weight signatures', async () => {
      const newSigner1 = ethers.Wallet.createRandom()
      const newSigner2 = ethers.Wallet.createRandom()

      const newConfig = {
        threshold: 10,
        signers: [{
          address: newSigner1.address,
          weight: 7
        }, {
          address: newSigner2.address,
          weight: 5
        }]
      }

      await account.updateConfig(newConfig, networks[0])
      const naccount = new lib.Account({ address: account.address, configTracker, networks, context }, newSigner1, newSigner2)

      const newConfig2 = { threshold: 2, signers: [{ address: newSigner2.address, weight: 2 }] }

      await naccount.updateConfig(newConfig2, networks[0])

      // Send a transaction, it should deploy + update wallet
      await naccount.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [512, []])
      })

      // Should be deployed, published and callReceiver updated
      const state = await account.getWalletState()
      expect(state.published).to.be.true
      expect(state.deployed).to.be.true
      expect(state.config).excluding('address').to.deep.equal(newConfig2)
      expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(512))
    })

    it('should fail to update if not enough signer', async () => {
      // Generate new signer
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 1 }] }

      // Update account to new config
      await account.updateConfig(newConfig, networks[0])

      // Generate another new config
      const newSigner2 = ethers.Wallet.createRandom()
      const newConfig2 = { threshold: 2, signers: [{ address: newSigner2.address, weight: 2 }] }

      // Update account to new config
      const update = account.updateConfig(newConfig2, networks[0].chainId)

      // Should fail
      await expect(update).to.be.rejected
    })

    describe('with nested signers', () => {
      let configTracker2: ConfigTracker
      let nestedWallet: lib.Wallet
      let account: lib.Account

      before(async () => {
        const signer1 = ethers.Wallet.createRandom()
        const signer2 = ethers.Wallet.createRandom()

        const config: WalletConfig = {
          threshold: 1,
          signers: [{
            address: signer1.address,
            weight: 1
          }, {
            address: signer2.address,
            weight: 1
          }]
        }

        nestedWallet = new lib.Wallet({ config, context }, signer1)
          .connect(networks[0].provider, networks[0].relayer as LocalRelayer)
        await nestedWallet.deploy()

        configTracker2 = new LocalConfigTracker(undefined, context, {
          [nestedWallet.address]: config
        })

        const initialConfig = {
          threshold: 1,
          signers: [{
            address: ethers.Wallet.createRandom().address,
            weight: 1
          }, {
            address: nestedWallet.address,
            weight: 1
          }]
        }

        account = await lib.Account.create({ context, configTracker: configTracker2, networks }, initialConfig, nestedWallet)
      })

      it.skip('Generate test case for sequence-sessions', async () => {
        const context2 = { ...context, sessionUtils: '0x300C03193BfC2f64462D0F309666806329d631DB' }
        const configTracker2 = new DebugConfigTracker(new LocalConfigTracker(undefined, context2, { [nestedWallet.address]: nestedWallet.config }))

        console.info("Assumed nested wallet address: " + nestedWallet.address + " = " + JSON.stringify(nestedWallet.config))

        const initialConfig = {
          threshold: 1,
          signers: [{
            address: ethers.Wallet.createRandom().address,
            weight: 1
          }, {
            address: nestedWallet.address,
            weight: 1
          }]
        }

        const account = await lib.Account.create({ context: context2, configTracker: configTracker2, networks }, initialConfig, nestedWallet)
        await account.updateConfig({ ...initialConfig, threshold: 22 }, networks[0])
      })

      it('should settle configuration after next transaction', async () => {
        // Force account to deploy wallet
        await account.sendTransaction({
          to: ethers.Wallet.createRandom().address,
          data: []
        })

        // Generate new config and update account
        const newSigner = ethers.Wallet.createRandom()
        const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 10 }, { address: owner.address, weight: 1 }] }

        await account.updateConfig(newConfig, networks[0])

        const naccount = new lib.Account({ address: account.address, configTracker: configTracker2, networks, context }, newSigner)
        await naccount.sendTransaction({
          to: callReceiver.address,
          data: callReceiver.interface.encodeFunctionData('testCall', [5991232, []])
        })

        // Get state, wallet should be deployed and published
        expect(await account.getWalletConfig()).excluding('address').to.deep.equal(newConfig)

        const state = await account.getWalletState()
        expect(state.published).to.be.true

        expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(5991232))
      })

    })
  })

  describe('config', () => {
    it('should create new instance', async () => {
      const signer = ethers.Wallet.createRandom()
      const config: WalletConfig = {
        threshold: 2,
        signers: [{
          weight: 1,
          address: signer.address
        }]
      }

      configTracker.saveWalletConfig({ config })
      configTracker.saveCounterFactualWallet({ context, imageHash: imageHash(config) })

      const address = addressOf(config, context)
      const account = new lib.Account({ context, address, configTracker }, signer)

      expect(await account.getWalletConfig()).excluding('address').to.deep.equal(config)
      expect(await account.getAddress()).to.equal(address)
      expect(await account.getSigners()).to.deep.equal([signer.address])
    })

    it('should update config and get current config from chain', async () => {
      // Generate new configuration
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()

      const config: WalletConfig = {
        threshold: 2,
        signers: [{
          weight: 1,
          address: signer1.address
        }, {
          weight: 1,
          address: signer2.address
        }]
      }

      // Should be able to update the account
      // without deploying anything
      expect(await account.isDeployed()).to.be.false

      // Update config
      await account.updateConfig(config, networks[0])

      // Account should get new config
      expect(await account.getWalletConfig()).excluding('address').to.deep.equal(config)

      // Creating a new account object with the same address
      // should also give us the updated configuration
      const account2 = new lib.Account({ address: account.address, configTracker, networks, context }, signer1)
      expect(await account2.getWalletConfig()).excluding('address').to.deep.equal(config)

      // Check wallet state
      const state = await account2.getWalletState()
      expect(state.config).excluding('address').to.deep.equal(config)
      expect(state.address).to.equal(account.address)
      expect(state.imageHash).to.equal(imageHash(config))
      expect(state.deployed).to.be.false
      expect(state.published).to.be.false
    })

    it('should find current config from published config on counter-factual wallet', async () => {
      // instanciate account without config
      const account2 = new lib.Account({ address: account.address, configTracker, networks, context }, owner)
      expect(account2.address).to.equal(account.address)

      // currentConfig which fetches wallet details from the authChain
      const currentConfig = await account2.getWalletConfig()
      expect(currentConfig).excluding('address').to.deep.equal(config)

      // wallet state
      const state = await account2.getWalletState()
      expect(state.config).excluding('address').to.deep.equal(config)
      expect(state.deployed).to.be.false
      expect(state.imageHash).to.equal(imageHash(config))
      expect(state.published).to.be.true
    })

    it('should return different configs for different chains', async () => {
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }

      await account.updateConfig(newConfig, 31338)

      const chain1 = await account.getWalletState()
      const chain2 = await account.getWalletState(31338)

      expect(chain1.config).excluding('address').to.deep.equal(config)
      expect(chain2.config).excluding('address').to.deep.equal(newConfig)
    })

    it('should return different configs for different chains after recreating account', async () => {
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }

      await account.updateConfig(newConfig, 31338)

      const importedAccount = new lib.Account({ address: account.address, configTracker, networks, context }, owner, newSigner)

      const chain1 = await importedAccount.getWalletState()
      const chain2 = await importedAccount.getWalletState(31338)

      expect(chain1.config).excluding('address').to.deep.equal(config)
      expect(chain2.config).excluding('address').to.deep.equal(newConfig)
    })

    it('should update the config in both chains', async () => {
      const newSigner1 = ethers.Wallet.createRandom()
      const newSigner2 = ethers.Wallet.createRandom()
      const newSigner3 = ethers.Wallet.createRandom()

      const newConfig = {
        threshold: 3,
        signers: [
          { address: newSigner1.address, weight: 10 },
          { address: newSigner2.address, weight: 10 },
          { address: newSigner3.address, weight: 10 }
        ]
      }

      await account.updateConfig(newConfig, networks[0], [networks[1]])

      const chain1 = await account.getWalletState()
      const chain2 = await account.getWalletState(31338)

      expect(chain1.config).excluding('address').to.deep.equal(newConfig)
      expect(chain2.config).excluding('address').to.deep.equal(newConfig)

      const importedAccount = new lib.Account({ address: account.address, configTracker, networks, context }, owner, newSigner1)

      const chain1_2 = await importedAccount.getWalletState()
      const chain2_2 = await importedAccount.getWalletState(31338)

      expect(chain1_2.config).excluding('address').to.deep.equal(newConfig)
      expect(chain2_2.config).excluding('address').to.deep.equal(newConfig)
    })

    it('should send transaction without decorations', async () => {
      await account.deploy()

      await account.sendTransaction({
        to: callReceiver.address,
        data: callReceiver.interface.encodeFunctionData('testCall', [333, []])
      })

      expect(await callReceiver.lastValA()).to.deep.equal(ethers.BigNumber.from(333))
    })

    describe.only('all pending configs', async () => {
      it("should return no pending configs for a new wallet", async () => {
        const { configs, failed } = await account.getPendingConfigs()
        expect(configs.length).to.equal(0)
        expect(failed.length).to.equal(0)
      })

      it("should return a single pending wallet config", async () => {
        const newSigner = ethers.Wallet.createRandom()
        const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }

        await account.updateConfig(newConfig, networks[0], [networks[1]])

        const { configs, failed } = await account.getPendingConfigs()
        expect(configs.length).to.equal(1)
        expect(failed.length).to.equal(0)
        expect(configs[0]).excluding('address').to.deep.equal(newConfig)
      })

      it("should return a single pending config for a different chain id", async () => {
        const newSigner = ethers.Wallet.createRandom()
        const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }

        await account.updateConfig(newConfig, networks[0], [networks[1]])

        const { configs, failed } = await account.getPendingConfigs(networks[1])
        expect(configs.length).to.equal(1)
        expect(failed.length).to.equal(0)
        expect(configs[0]).excluding('address').to.deep.equal(newConfig)
      })

      it("should return no pending config if the chain id wasn't updated", async () => {
        const newSigner = ethers.Wallet.createRandom()
        const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }

        await account.updateConfig(newConfig, networks[0])

        const { configs, failed } = await account.getPendingConfigs(networks[1])
        expect(configs.length).to.equal(0)
        expect(failed.length).to.equal(0)
      })

      it("should return two pending configs", async () => {
        const newSigner1 = ethers.Wallet.createRandom()
        const newSigner2 = ethers.Wallet.createRandom()
        const newConfig1 = { threshold: config.threshold, signers: [...config.signers, { address: newSigner1.address, weight: 10 }] }
        const newConfig2 = { threshold: config.threshold, signers: [...newConfig1.signers, { address: newSigner2.address, weight: 10 }] }

        await account.updateConfig(newConfig1, networks[0], [networks[1]])
        await account.updateConfig(newConfig2, networks[0], [networks[1]])

        const { configs, failed } = await account.getPendingConfigs()
        expect(configs.length).to.equal(2)
        expect(failed.length).to.equal(0)
        expect(configs[0]).excluding('address').to.deep.equal(newConfig1)
        expect(configs[1]).excluding('address').to.deep.equal(newConfig2)
      })

      it("should return two pending configs for a different network", async () => {
        const newSigner1 = ethers.Wallet.createRandom()
        const newSigner2 = ethers.Wallet.createRandom()
        const newConfig1 = { threshold: config.threshold, signers: [...config.signers, { address: newSigner1.address, weight: 10 }] }
        const newConfig2 = { threshold: config.threshold, signers: [...newConfig1.signers, { address: newSigner2.address, weight: 10 }] }

        await account.updateConfig(newConfig1, networks[0], [networks[1]])
        await account.updateConfig(newConfig2, networks[0], [networks[1]])

        const { configs, failed } = await account.getPendingConfigs(networks[1])
        expect(configs.length).to.equal(2)
        expect(failed.length).to.equal(0)
        expect(configs[0]).excluding('address').to.deep.equal(newConfig1)
        expect(configs[1]).excluding('address').to.deep.equal(newConfig2)
      })

      it("should not return pending configs if wallet sent a transaction", async () => {
        const newSigner1 = ethers.Wallet.createRandom()
        const newSigner2 = ethers.Wallet.createRandom()
        const newConfig1 = { threshold: config.threshold, signers: [...config.signers, { address: newSigner1.address, weight: 10 }] }
        const newConfig2 = { threshold: config.threshold, signers: [...newConfig1.signers, { address: newSigner2.address, weight: 10 }] }

        await account.updateConfig(newConfig1, networks[0], [networks[1]])
        await account.updateConfig(newConfig2, networks[0], [networks[1]])

        await account.sendTransaction({ to: account.address, value: 0 })
        await account.sendTransaction({ to: account.address, value: 0 })

        const { configs, failed } = await account.getPendingConfigs()
        expect(configs.length).to.equal(0)
        expect(failed.length).to.equal(0)
      })

      it("should still return pending configs if wallet sent a transaction (on another network)", async () => {
        const newSigner1 = ethers.Wallet.createRandom()
        const newSigner2 = ethers.Wallet.createRandom()
        const newConfig1 = { threshold: config.threshold, signers: [...config.signers, { address: newSigner1.address, weight: 10 }] }
        const newConfig2 = { threshold: config.threshold, signers: [...newConfig1.signers, { address: newSigner2.address, weight: 10 }] }

        await account.updateConfig(newConfig1, networks[0], [networks[1]])
        await account.updateConfig(newConfig2, networks[0], [networks[1]])

        await account.sendTransaction({ to: account.address, value: 0 })

        const { configs, failed } = await account.getPendingConfigs(networks[1])
        expect(configs.length).to.equal(2)
        expect(failed.length).to.equal(0)
        expect(configs[0]).excluding('address').to.deep.equal(newConfig1)
        expect(configs[1]).excluding('address').to.deep.equal(newConfig2)
      })

      it.only("should return new pending config after sending a transaction and updating again", async () => {
        const newSigner1 = ethers.Wallet.createRandom()
        const newSigner2 = ethers.Wallet.createRandom()
        const newConfig1 = { threshold: config.threshold, signers: [...config.signers, { address: newSigner1.address, weight: 10 }] }
        const newConfig2 = { threshold: config.threshold, signers: [...newConfig1.signers, { address: newSigner2.address, weight: 10 }] }

        await account.updateConfig(newConfig1, networks[0], [networks[1]])
        await account.updateConfig(newConfig2, networks[0], [networks[1]])

        await account.sendTransaction({ to: account.address, value: 0 })
        
        // Update again
        const newConfig3 = { threshold: config.threshold, signers: [...newConfig2.signers, { address: newSigner1.address, weight: 10 }] }
        await account.updateConfig(newConfig3, networks[0], [networks[1]])

        await account.sendTransaction({ to: account.address, value: 0 })

        console.log("config 0", imageHash(config))
        console.log("config 1", imageHash(newConfig1))
        console.log("config 2", imageHash(newConfig2))
        console.log("config 3", imageHash(newConfig3))

        const newConfig4 = { threshold: config.threshold, signers: [...newConfig3.signers, { address: newSigner2.address, weight: 10 }] }
        console.log("config 4", imageHash(newConfig4))

        await account.updateConfig(newConfig4, networks[0], [networks[1]])
        console.log("deploy tx", await account.buildDeployTransaction())
        await account.sendTransaction({ to: account.address, value: 0 })

        const { configs, failed } = await account.getPendingConfigs()
        expect(configs.length).to.equal(1)
        expect(failed.length).to.equal(0)
        expect(configs[0]).excluding('address').to.deep.equal(newConfig3)
      })
    })
  })

  // TODO Do we need to be able to change the networks?
  // we may as well just create a new account, is cheaper

  // describe('networks', () => {
  //   it('should set valid default network', async () => {
  //     expect(() => {
  //       account.setNetworks(networks, [], 31337)
  //     }).to.not.throw
  //   })

  //   it('should fail to set invalid default network', async () => {
  //     expect(() => {
  //       account.setNetworks(networks, [], 123)
  //     }).to.throw(`unable to set default network as chain '123' does not exist`)
  //   })
  // })

  describe('state information', () => {
    it('Should return false if wallet is not deployed', async () => {
      expect(await account.isDeployed()).to.be.false
    })

    it('Should return true if wallet is deployed and config is up to date', async () => {
      // Force account to deploy wallet
      await account.sendTransaction({ to: ethers.Wallet.createRandom().address, value: 0 })

      // Check if account is deployed
      const state = await account.getWalletState()
      expect(state.deployed).to.be.true
      expect(state.published).to.be.true
    })

    it('It should return false if the wallet is deployed but there is a pending configuration update', async () => {
      // Force account to deploy wallet
      await account.sendTransaction({ to: ethers.Wallet.createRandom().address, value: 0 })

      // Generate new config and update account
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }
      await account.updateConfig(newConfig, networks[0])

      // Get state, wallet should be deployed but not published
      const state = await account.getWalletState()
      expect(state.config).excluding('address').to.deep.equal(newConfig)
      expect(state.deployed).to.be.true
      expect(state.published).to.be.false
    })

    it('It should return publised and deployed once the pre-signed transaction is settled', async () => {
      // Force account to deploy wallet
      await account.sendTransaction({ to: ethers.Wallet.createRandom().address, value: 0, nonce: encodeNonce(2, 0) });

      // Generate new config and update account
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 1, signers: [{ address: newSigner.address, weight: 10 }, { address: owner.address, weight: 1 }] }
      await account.updateConfig(newConfig, networks[0])
      await account.sendTransaction({ to: ethers.Wallet.createRandom().address, value: 0 })

      // Get state, wallet should be deployed and published
      const state = await account.getWalletState()
      expect(state.config).excluding('address').to.deep.equal(newConfig)
      expect(state.deployed).to.be.true
    })
  })
})
