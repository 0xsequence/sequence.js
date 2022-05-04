import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import { ethers } from 'ethers'
import hardhat from 'hardhat'
import { WalletContext, NetworkConfig } from '@0xsequence/network'
import { LocalRelayer, RpcRelayer } from '@0xsequence/relayer'
import { deployWalletContext } from './utils/deploy-wallet-context'
import { isValidConfigSigners, imageHash, SequenceUtilsFinder } from '@0xsequence/config'
import { configureLogger } from '@0xsequence/utils'

import * as lib from '../src'
import { isWalletUpToDate } from '../../provider/src/utils'
import { isConfigEqual } from '../../config/src/config'
import { describe } from 'mocha'

const { expect } = chai.use(chaiAsPromised)

configureLogger({ logLevel: 'DEBUG', silence: false })

describe('Account integration', () => {
  let context: WalletContext
  let account: lib.Account
  let owner: ethers.Wallet

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
      isAuthChain: true
    },
    {
      chainId: 31338,
      name: 'hardhat2',
      rpcUrl: nodeB,
      provider: providerB,
      relayer: new LocalRelayer({ signer: signerB }),
      isDefaultChain: false,
      isAuthChain: false
    }
  ]

  before(async () => {
    // Deploy Sequence context
    const [factory, mainModule, mainModuleUpgradable, guestModule, sequenceUtils, requireFreshSigner] = await deployWalletContext(
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
      libs: {
        requireFreshSigner: requireFreshSigner.address
      }
    }
  })

  beforeEach(async () => {
    // Create account
    owner = new ethers.Wallet(ethers.utils.randomBytes(32))
    const wallet = await lib.Wallet.singleOwner(owner, context)

    account = new lib.Account(
      {
        initialConfig: wallet.config,
        networks,
        context
      },
      owner
    )
  })

  describe('find wallet by signer', () => {
    it('should find wallet of an indexed signer', async () => {
      const owner = new ethers.Wallet(ethers.utils.randomBytes(32))
      const wallet = (await lib.Wallet.singleOwner(owner, context)).connect(
        networks[0].provider,
        networks[0].relayer as RpcRelayer
      )

      await wallet.publishConfig(true)

      const found = await new SequenceUtilsFinder(networks[0].provider).findLastWalletOfInitialSigner({
        signer: owner.address,
        context: context,
        provider: networks[0].provider
      })

      expect(found.wallet).to.equal(wallet.address)
    })
    it('should find wallet of not indexed signer', async () => {
      const owner = new ethers.Wallet(ethers.utils.randomBytes(32))
      const wallet = (await lib.Wallet.singleOwner(owner, context)).connect(
        networks[0].provider,
        networks[0].relayer as RpcRelayer
      )

      await wallet.publishConfig(false)

      const found = await new SequenceUtilsFinder(networks[0].provider).findLastWalletOfInitialSigner({
        signer: owner.address,
        context: context,
        provider: networks[0].provider
      })

      expect(found.wallet).to.equal(wallet.address)
    })
    it('should find wallet of indexed signer, ignoring index', async () => {
      const owner = new ethers.Wallet(ethers.utils.randomBytes(32))
      const wallet = (await lib.Wallet.singleOwner(owner, context)).connect(
        networks[0].provider,
        networks[0].relayer as RpcRelayer
      )

      await wallet.publishConfig(true)

      const found = await new SequenceUtilsFinder(networks[0].provider).findLastWalletOfInitialSigner({
        signer: owner.address,
        context: context,
        provider: networks[0].provider,
        ignoreIndex: true
      })

      expect(found.wallet).to.equal(wallet.address)
    })
    it('should not find wallet of not published signer', async () => {
      const owner = new ethers.Wallet(ethers.utils.randomBytes(32))

      const found = await new SequenceUtilsFinder(networks[0].provider).findLastWalletOfInitialSigner({
        signer: owner.address,
        context: context,
        provider: networks[0].provider
      })

      expect(found.wallet).to.be.undefined
    })
  })

  describe('config', () => {
    it('should create new instance', async () => {
      const owner = new ethers.Wallet(ethers.utils.randomBytes(32))
      const wallet = (await lib.Wallet.singleOwner(owner)).connect(networks[0].provider)

      expect(await wallet.getChainId()).to.equal(31337)
      expect((await wallet.getWalletConfig())[0].signers[0].address).to.equal(await owner.getAddress())

      const account = new lib.Account({
        initialConfig: (await wallet.getWalletConfig())[0],
        networks
      }).useSigners(owner)

      expect(await account.getChainId()).to.equal(31337)
      expect((await account.getWalletConfig())[0].signers[0].address).to.equal(await owner.getAddress())

      expect(await wallet.getAddress()).to.equal(await account.getAddress())
      expect(await wallet.getSigners()).to.deep.equal(await account.getSigners())
    })

    it('should update config and get current config from chain', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false

      // deploy the wallet
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig((await lib.Wallet.singleOwner(newSigner)).config)
      expect(await account.isDeployed()).to.be.true

      // instanciate account without known new config
      const account2 = new lib.Account(
        {
          initialConfig: wallet.config,
          networks,
          context
        },
        owner
      )

      // currentConfig which fetches wallet details from the authChain
      const currentConfig = await account2.currentConfig()
      expect(currentConfig.address).to.equal(await account2.getAddress())
      expect(currentConfig.signers.length).to.equal(1)
      expect(currentConfig.signers[0].weight).to.equal(1)
      expect(currentConfig.signers[0].address).to.equal(await newSigner.getAddress())
      expect(currentConfig.chainId).to.equal(await account2.getChainId())

      // wallet state
      const state = (await account2.getWalletState())[0]
      expect(state.config.address).to.equal(await account2.getAddress())
      expect(state.deployed).to.equal(true)
      expect(state.imageHash).to.not.equal(state.lastImageHash)
      expect(state.lastImageHash).to.equal(imageHash(currentConfig))
    })

    it('should update config and get current config from chain, not indexed', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false

      // deploy the wallet
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig((await lib.Wallet.singleOwner(newSigner)).config, false)
      expect(await account.isDeployed()).to.be.true

      // instanciate account without known new config
      const account2 = new lib.Account(
        {
          initialConfig: wallet.config,
          networks,
          context
        },
        owner
      )

      // currentConfig which fetches wallet details from the authChain
      const currentConfig = await account2.currentConfig()
      expect(currentConfig.address).to.equal(await account2.getAddress())
      expect(currentConfig.signers.length).to.equal(1)
      expect(currentConfig.signers[0].weight).to.equal(1)
      expect(currentConfig.signers[0].address).to.equal(await newSigner.getAddress())
      expect(currentConfig.chainId).to.equal(await account2.getChainId())

      // wallet state
      const state = (await account2.getWalletState())[0]
      expect(state.config.address).to.equal(await account2.getAddress())
      expect(state.deployed).to.equal(true)
      expect(state.imageHash).to.not.equal(state.lastImageHash)
      expect(state.lastImageHash).to.equal(imageHash(currentConfig))
    })

    it('should find current config from published config on counter-factual wallet', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false
      await account.publishConfig()

      // instanciate account without config
      const account2 = new lib.Account(
        {
          initialConfig: { address: account.address, threshold: 0, signers: [] },
          networks,
          context
        },
        owner
      )

      expect(account2.address).to.equal(account.address)

      // currentConfig which fetches wallet details from the authChain
      const currentConfig = await account2.currentConfig()
      expect(currentConfig.address).to.equal(await account2.getAddress())
      expect(currentConfig.signers.length).to.equal(1)
      expect(currentConfig.signers[0].weight).to.equal(1)
      expect(currentConfig.signers[0].address).to.equal(await owner.getAddress())
      expect(currentConfig.chainId).to.equal(await account2.getChainId())

      // wallet state
      const state = (await account2.getWalletState())[0]
      expect(state.config.address).to.equal(await account2.getAddress())
      expect(state.deployed).to.equal(true)
      expect(state.imageHash).to.not.equal(state.lastImageHash)
      expect(state.lastImageHash).to.equal('')
    })

    it('should find current config from published config on counter-factual wallet, not indexed', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false
      await account.publishConfig(false)

      // instanciate account without config
      const account2 = new lib.Account(
        {
          initialConfig: { address: account.address, threshold: 0, signers: [] },
          networks,
          context
        },
        owner
      )

      expect(account2.address).to.equal(account.address)

      // currentConfig which fetches wallet details from the authChain
      const currentConfig = await account2.currentConfig()
      expect(currentConfig.address).to.equal(await account2.getAddress())
      expect(currentConfig.signers.length).to.equal(1)
      expect(currentConfig.signers[0].weight).to.equal(1)
      expect(currentConfig.signers[0].address).to.equal(await owner.getAddress())
      expect(currentConfig.chainId).to.equal(await account2.getChainId())

      // wallet state
      const state = (await account2.getWalletState())[0]
      expect(state.config.address).to.equal(await account2.getAddress())
      expect(state.deployed).to.equal(true)
      expect(state.imageHash).to.not.equal(state.lastImageHash)
      expect(state.lastImageHash).to.equal('')
    })

    it('should update config and get current config from chain, matching defined imageHash', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false

      // deploy the wallet
      await account.updateConfig()
      expect(await account.isDeployed()).to.be.true

      // currentConfig which fetches wallet details from the authChain
      const currentConfig = await account.currentConfig()
      expect(currentConfig.address).to.equal(await account.getAddress())
      expect(currentConfig.signers.length).to.equal(1)
      expect(currentConfig.signers[0].weight).to.equal(1)
      expect(currentConfig.signers[0].address).to.equal(await owner.getAddress())
      expect(currentConfig.chainId).to.equal(await account.getChainId())

      // wallet state
      const state = (await account.getWalletState())[0]
      expect(state.config.address).to.equal(await account.getAddress())
      expect(state.deployed).to.equal(true)
      expect(state.imageHash).to.equal(state.lastImageHash)
      expect(state.imageHash).to.equal(imageHash(currentConfig))
    })

    it('should return different configs for different chains (indexed)', async () => {
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig({ threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }, true)

      const state = await account.getWalletState()
      const authState = state[0].config
      const altState = state[1].config

      expect(authState.threshold).to.equal(3)
      expect(authState.signers.length).to.equal(1)
      expect(authState.signers[0].weight).to.equal(10)
      expect(authState.signers[0].address).to.equal(newSigner.address)

      expect(altState.threshold).to.equal(1)
      expect(altState.signers.length).to.equal(1)
      expect(altState.signers[0].weight).to.equal(1)
      expect(altState.signers[0].address).to.equal(owner.address)
    })

    it('should return different configs for different chains (not-indexed)', async () => {
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig({ threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }, false)

      const state = await account.getWalletState()
      const authState = state[0].config
      const altState = state[1].config

      expect(authState.threshold).to.equal(3)
      expect(authState.signers.length).to.equal(1)
      expect(authState.signers[0].weight).to.equal(10)
      expect(authState.signers[0].address).to.equal(newSigner.address)

      expect(altState.threshold).to.equal(1)
      expect(altState.signers.length).to.equal(1)
      expect(altState.signers[0].weight).to.equal(1)
      expect(altState.signers[0].address).to.equal(owner.address)
    })

    it('should return different configs for different chains after reload auth config (indexed)', async () => {
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig({ threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }, true)

      const importedAccount = new lib.Account(
        {
          initialConfig: account.authWallet().wallet.config,
          networks,
          context
        },
        owner
      )

      const state = await importedAccount.getWalletState()
      const authState = state[0].config
      const altState = state[1].config

      expect(authState.threshold).to.equal(3)
      expect(authState.signers.length).to.equal(1)
      expect(authState.signers[0].weight).to.equal(10)
      expect(authState.signers[0].address).to.equal(newSigner.address)

      expect(altState.threshold).to.equal(1)
      expect(altState.signers.length).to.equal(1)
      expect(altState.signers[0].weight).to.equal(1)
      expect(altState.signers[0].address).to.equal(owner.address)
    })

    it('should return different configs for different chains after reload auth config (not-indexed)', async () => {
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig({ threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }, false)

      const importedAccount = new lib.Account(
        {
          initialConfig: account.authWallet().wallet.config,
          networks,
          context
        },
        owner
      )

      const state = await importedAccount.getWalletState()
      const authState = state[0].config
      const altState = state[1].config

      expect(authState.threshold).to.equal(3)
      expect(authState.signers.length).to.equal(1)
      expect(authState.signers[0].weight).to.equal(10)
      expect(authState.signers[0].address).to.equal(newSigner.address)

      expect(altState.threshold).to.equal(1)
      expect(altState.signers.length).to.equal(1)
      expect(altState.signers[0].weight).to.equal(1)
      expect(altState.signers[0].address).to.equal(owner.address)
    })

    it('should return different configs for different chains after reload alt config (indexed)', async () => {
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }

      await account.publishConfig(true)
      await account.updateConfig(newConfig, true)

      const importedAccount = new lib.Account(
        {
          initialConfig: { address: account.address, ...newConfig },
          networks,
          context
        },
        owner
      )

      const state = await importedAccount.getWalletState()
      const authState = state[0].config
      const altState = state[1].config

      expect(authState.threshold).to.equal(3)
      expect(authState.signers.length).to.equal(1)
      expect(authState.signers[0].weight).to.equal(10)
      expect(authState.signers[0].address).to.equal(newSigner.address)

      expect(altState.threshold).to.equal(1)
      expect(altState.signers.length).to.equal(1)
      expect(altState.signers[0].weight).to.equal(1)
      expect(altState.signers[0].address).to.equal(owner.address)
    })

    it('should return different configs for different chains after reload alt config (not-indexed)', async () => {
      const newSigner = ethers.Wallet.createRandom()
      const newConfig = { threshold: 3, signers: [{ address: newSigner.address, weight: 10 }] }

      await account.publishConfig(false)
      await account.updateConfig(newConfig, false)

      const importedAccount = new lib.Account(
        {
          initialConfig: { address: account.address, ...newConfig },
          networks,
          context
        },
        owner
      )

      const state = await importedAccount.getWalletState()
      const authState = state[0].config
      const altState = state[1].config

      expect(authState.threshold).to.equal(3)
      expect(authState.signers.length).to.equal(1)
      expect(authState.signers[0].weight).to.equal(10)
      expect(authState.signers[0].address).to.equal(newSigner.address)

      expect(altState.threshold).to.equal(1)
      expect(altState.signers.length).to.equal(1)
      expect(altState.signers[0].weight).to.equal(1)
      expect(altState.signers[0].address).to.equal(owner.address)
    })
  })

  describe('networks', () => {
    it('should set valid default network', async () => {
      // expect(() => {
      //   account.setNetworks(networks, [], 31337)
      // }).to.not.throw

      account.setNetworks(networks, [], 31338)

      expect(await account.getChainId()).to.equal(31338)
    })

    it('should fail to set invalid default network', async () => {
      expect(() => {
        account.setNetworks(networks, [], 123)
      }).to.throw(`unable to set default network as chain '123' does not exist`)
    })
  })

  describe('isWalletUpToDate util', () => {
    it('Should return false if wallet is not deployed', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false
      expect(await isWalletUpToDate(account, 31337)).to.be.false
    })

    it('Should return true if wallet is deployed and config is up to date', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners((await account.getWalletConfig())[0], await account.getSigners())).to.be.true

      expect(await account.isDeployed()).to.be.false

      // deploy the wallet
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig((await lib.Wallet.singleOwner(newSigner)).config)
      expect(await account.isDeployed()).to.be.true
      expect(await isWalletUpToDate(account, 31337)).to.be.true
    })

    it('Should return true if non auth chain wallet is deployed and configs are equal', async () => {
      const { wallet } = account.getWallets()[0]
      expect(await wallet.getAddress()).to.equal(await account.getAddress())
      const initialConfig = (await account.getWalletConfig())[0]

      const signers = await account.getSigners()
      expect(signers[0]).to.equal(await owner.getAddress())
      expect(isValidConfigSigners(initialConfig, await account.getSigners())).to.be.true

      // update config / deploy for auth chain
      const newSigner = ethers.Wallet.createRandom()
      await account.updateConfig((await lib.Wallet.singleOwner(newSigner)).config)
      expect(await account.isDeployed()).to.be.true
      expect(await isWalletUpToDate(account, 31337)).to.be.true
      expect(await isWalletUpToDate(account, 31338)).to.be.false

      // update config / deploy for chainId 31338
      await account.getWalletByNetwork(31338).wallet.updateConfig((await lib.Wallet.singleOwner(newSigner)).config)
      expect(await account.getWalletByNetwork(31338).wallet.isDeployed()).to.be.true
      expect(isConfigEqual(account.getWalletByNetwork(31337).wallet.config, account.getWalletByNetwork(31338).wallet.config)).to
        .be.true
      expect(await isWalletUpToDate(account, 31338)).to.be.true
    })
  })
})
