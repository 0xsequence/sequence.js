
import hardhat from 'hardhat'
import * as chai from 'chai'
import * as utils from '@0xsequence/tests'

import { ethers } from 'ethers'
import { Orchestrator } from '@0xsequence/signhub'
import { Account } from '../src/account'
import { migrator } from '@0xsequence/migration'
import { NetworkConfig } from '@0xsequence/network'
import { tracker, trackers } from '@0xsequence/sessions'
import { LocalRelayer, Relayer } from '@0xsequence/relayer'
import { commons, v1, v2 } from '@0xsequence/core'
import chaiAsPromised from 'chai-as-promised'
import { Wallet } from '@0xsequence/wallet'

const { expect } = chai.use(chaiAsPromised)

describe('Account', () => {
  let provider1: ethers.providers.JsonRpcProvider
  let provider2: ethers.providers.JsonRpcProvider

  let signer1: ethers.Signer
  let signer2: ethers.Signer

  let contexts: commons.context.VersionedContext
  let networks: NetworkConfig[]

  let tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker

  let defaultArgs: {
    contexts: commons.context.VersionedContext
    networks: NetworkConfig[]
    tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
  }

  before(async () => {
    provider1 = new ethers.providers.Web3Provider(hardhat.network.provider.send)
    provider2 = new ethers.providers.JsonRpcProvider('http://127.0.0.1:7048')

    // TODO: Implement migrations on local config tracker
    tracker = new trackers.local.LocalConfigTracker(provider1) as any

    networks = [{
      chainId: 31337,
      name: 'hardhat',
      provider: provider1,
      relayer: new LocalRelayer(provider1.getSigner())
    }, {
      chainId: 31338,
      name: 'hardhat2',
      provider: provider2,
      relayer: new LocalRelayer(provider2.getSigner())
    }]

    signer1 = provider1.getSigner()
    signer2 = provider2.getSigner()

    contexts = await utils.context.deploySequenceContexts(signer1)
    const context2 = await utils.context.deploySequenceContexts(signer2)

    expect(contexts).to.deep.equal(context2)

    defaultArgs = {
      contexts,
      networks,
      tracker,
    }
  })

  describe('New account', () => {
    it('Should create a new account', async () => {
      const signer = ethers.Wallet.createRandom()
      const config = {
        threshold: 1,
        checkpoint: Math.floor(Date.now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer]),
      })

      expect(account).to.be.instanceOf(Account)
      expect(account.address).to.not.be.undefined

      await account.sendTransaction([], networks[0].chainId)

      const status = await account.status(networks[0].chainId)
      expect(status.fullyMigrated).to.be.true
      expect(status.onChain.deployed).to.be.true
      expect(status.onChain.version).to.equal(2)
    })

    it('Should send transactions on multiple networks', async () => {
      const signer = ethers.Wallet.createRandom()
      const config = {
        threshold: 1,
        checkpoint: Math.floor(Date.now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer]),
      })

      await account.sendTransaction([], networks[0].chainId)
      await account.sendTransaction([], networks[1].chainId)

      const status1 = await account.status(networks[0].chainId)
      const status2 = await account.status(networks[1].chainId)

      expect(status1.fullyMigrated).to.be.true
      expect(status1.onChain.deployed).to.be.true
      expect(status1.onChain.version).to.equal(2)

      expect(status2.fullyMigrated).to.be.true
      expect(status2.onChain.deployed).to.be.true
      expect(status2.onChain.version).to.equal(2)
    })

    it('Should create a new account with many signers', async () => {
      const signers = new Array(24).fill(0).map(() => ethers.Wallet.createRandom())
      const config = {
        threshold: 3,
        checkpoint: Math.floor(Date.now() / 1000),
        signers: signers.map((signer) => ({
          address: signer.address, weight: 1
        }))
      }

      const rsigners = signers.sort(() => Math.random() - 0.5)
      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator(rsigners.slice(0, 4)),
      })

      await account.sendTransaction([], networks[0].chainId)

      const status = await account.status(networks[0].chainId)
      expect(status.fullyMigrated).to.be.true
      expect(status.onChain.deployed).to.be.true
      expect(status.onChain.version).to.equal(2)
    })

    it('Should sign and validate a message', async () => {
      const signer = ethers.Wallet.createRandom()
      const config = {
        threshold: 1,
        checkpoint: Math.floor(Date.now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer]),
      })

      await account.doBootstrap(networks[0].chainId)

      const msg = ethers.utils.toUtf8Bytes('Hello World')
      const sig = await account.signMessage(msg, networks[0].chainId)

      const valid = await commons.EIP1271.isValidEIP1271Signature(
        account.address,
        ethers.utils.keccak256(msg),
        sig,
        networks[0].provider!
      )

      expect(valid).to.be.true
    })

    it('Should update account to new configuration', async () => {
      const signer = ethers.Wallet.createRandom()
      const simpleConfig1 = {
        threshold: 1,
        checkpoint: Math.floor(Date.now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }
      const config1 = v2.config.ConfigCoder.fromSimple(simpleConfig1)

      const account = await Account.new({
        ...defaultArgs,
        config: simpleConfig1,
        orchestrator: new Orchestrator([signer]),
      })

      const signer2a = ethers.Wallet.createRandom()
      const signer2b = ethers.Wallet.createRandom()

      const simpleConfig2 = {
        threshold: 4,
        checkpoint: Math.floor(Date.now() / 1000) + 1,
        signers: [{
          address: signer2a.address,
          weight: 2
        }, {
          address: signer2b.address,
          weight: 2
        }]
      }

      const config2 = v2.config.ConfigCoder.fromSimple(simpleConfig2)
      await account.updateConfig(config2)
  
      const status2 = await account.status(networks[0].chainId)
      expect(status2.fullyMigrated).to.be.true
      expect(status2.onChain.deployed).to.be.false
      expect(status2.onChain.version).to.equal(2)
      expect(status2.onChain.imageHash).to.deep.equal(v2.config.ConfigCoder.imageHashOf(config1))
      expect(status2.imageHash).to.deep.equal(v2.config.ConfigCoder.imageHashOf(config2))
    })

    describe('After upgrading', () => {
      let account: Account

      let signer1: ethers.Wallet
      let signer2a: ethers.Wallet
      let signer2b: ethers.Wallet

      beforeEach(async () => {
        signer1 = ethers.Wallet.createRandom()
        const simpleConfig1 = {
          threshold: 1,
          checkpoint: Math.floor(Date.now() / 1000) + 1,
          signers: [{ address: signer1.address, weight: 1 }]
        }

        account = await Account.new({
          ...defaultArgs,
          config: simpleConfig1,
          orchestrator: new Orchestrator([signer1]),
        })

        signer2a = ethers.Wallet.createRandom()
        signer2b = ethers.Wallet.createRandom()

        const simpleConfig2 = {
          threshold: 4,
          checkpoint: await account.status(0).then((s) => ethers.BigNumber.from(s.checkpoint).add(1)),
          signers: [{
            address: signer2a.address,
            weight: 2
          }, {
            address: signer2b.address,
            weight: 2
          }]
        }

        const config2 = v2.config.ConfigCoder.fromSimple(simpleConfig2)
        await account.updateConfig(config2)
        account.setOrchestrator(new Orchestrator([signer2a, signer2b]))
      })

      it('Should send a transaction', async () => {
        const tx = await account.sendTransaction([], networks[0].chainId)
        expect(tx).to.not.be.undefined

        const status = await account.status(networks[0].chainId)
        expect(status.fullyMigrated).to.be.true
        expect(status.onChain.deployed).to.be.true
        expect(status.onChain.imageHash).to.equal(status.imageHash)
      })

      it('Should sign a message', async () => {
        const msg = ethers.utils.toUtf8Bytes('Hello World')
        const sig = await account.signMessage(msg, networks[0].chainId)

        const canOnchainValidate = await account.status(networks[0].chainId).then((s) => s.canOnchainValidate)
        expect(canOnchainValidate).to.be.false
        await account.doBootstrap(networks[0].chainId)

        const valid = await commons.EIP1271.isValidEIP1271Signature(
          account.address,
          ethers.utils.keccak256(msg),
          sig,
          networks[0].provider!
        )

        expect(valid).to.be.true
      })

      it('Should fail to use old signer', async () => {
        account.setOrchestrator(new Orchestrator([signer1]))
        const tx = account.sendTransaction([], networks[0].chainId)
        await expect(tx).to.be.rejected
      })

      it('Should send a transaction on a different network', async () => {
        const tx = await account.sendTransaction([], networks[1].chainId)
        expect(tx).to.not.be.undefined

        const status = await account.status(networks[1].chainId)
        expect(status.fullyMigrated).to.be.true
        expect(status.onChain.deployed).to.be.true
        expect(status.onChain.imageHash).to.equal(status.imageHash)
      })

      describe('After reloading the account', () => {
        beforeEach(async () => {
          account = new Account({
            ...defaultArgs,
            address: account.address,
            orchestrator: new Orchestrator([signer2a, signer2b])
          })
        })

        it('Should send a transaction', async () => {
          const tx = await account.sendTransaction([], networks[0].chainId)
          expect(tx).to.not.be.undefined

          const status = await account.status(networks[0].chainId)
          expect(status.fullyMigrated).to.be.true
          expect(status.onChain.deployed).to.be.true
          expect(status.onChain.imageHash).to.equal(status.imageHash)
        })

        it('Should sign a message', async () => {
          const msg = ethers.utils.toUtf8Bytes('Hello World')
          const sig = await account.signMessage(msg, networks[0].chainId)

          const canOnchainValidate = await account.status(networks[0].chainId).then((s) => s.canOnchainValidate)
          expect(canOnchainValidate).to.be.false
          await account.doBootstrap(networks[0].chainId)

          const valid = await commons.EIP1271.isValidEIP1271Signature(
            account.address,
            ethers.utils.keccak256(msg),
            sig,
            networks[0].provider!
          )

          expect(valid).to.be.true
        })
      })

      describe('After updating the config again', () => {
        let signer3a: ethers.Wallet
        let signer3b: ethers.Wallet
        let signer3c: ethers.Wallet

        let config3: v2.config.WalletConfig

        beforeEach(async () => {
          signer3a = ethers.Wallet.createRandom()
          signer3b = ethers.Wallet.createRandom()
          signer3c = ethers.Wallet.createRandom()

          const simpleConfig3 = {
            threshold: 5,
            checkpoint: await account.status(0).then((s) => ethers.BigNumber.from(s.checkpoint).add(1)),
            signers: [{
              address: signer3a.address,
              weight: 2
            }, {
              address: signer3b.address,
              weight: 2
            }, {
              address: signer3c.address,
              weight: 1
            }]
          }

          config3 = v2.config.ConfigCoder.fromSimple(simpleConfig3)

          await account.updateConfig(config3)
          account.setOrchestrator(new Orchestrator([signer3a, signer3b, signer3c]))
        })

        it('Should update account status', async () => {
          const status = await account.status(networks[0].chainId)
          expect(status.fullyMigrated).to.be.true
          expect(status.onChain.deployed).to.be.false
          expect(status.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(config3))
          expect(status.presignedConfigurations.length).to.equal(2)
        })

        it('Should send a transaction', async () => {
          const tx = await account.sendTransaction([], networks[0].chainId)
          expect(tx).to.not.be.undefined

          const status = await account.status(networks[0].chainId)
          expect(status.fullyMigrated).to.be.true
          expect(status.onChain.deployed).to.be.true
          expect(status.onChain.imageHash).to.equal(status.imageHash)
        })

        it('Should sign a message', async () => {
          const msg = ethers.utils.toUtf8Bytes('Hello World')
          const sig = await account.signMessage(msg, networks[0].chainId)

          const canOnchainValidate = await account.status(networks[0].chainId).then((s) => s.canOnchainValidate)
          expect(canOnchainValidate).to.be.false
          await account.doBootstrap(networks[0].chainId)

          const status = await account.status(networks[0].chainId)
          expect(status.onChain.imageHash).to.not.equal(status.imageHash)

          const valid = await commons.EIP1271.isValidEIP1271Signature(
            account.address,
            ethers.utils.keccak256(msg),
            sig,
            networks[0].provider!
          )

          expect(valid).to.be.true
        })
      })

      describe('After sending a transaction', () => {
        beforeEach(async () => {
          await account.sendTransaction([], networks[0].chainId)
        })

        it('Should send a transaction in a different network', async () => {
          const tx = await account.sendTransaction([], networks[1].chainId)
          expect(tx).to.not.be.undefined

          const status = await account.status(networks[1].chainId)
          expect(status.fullyMigrated).to.be.true
          expect(status.onChain.deployed).to.be.true
          expect(status.onChain.imageHash).to.equal(status.imageHash)
        })

        it('Should send a second transaction', async () => {
          const tx = await account.sendTransaction([], networks[0].chainId)
          expect(tx).to.not.be.undefined
        })

        it('Should update the configuration again', async () => {
          const signer2a = ethers.Wallet.createRandom()
          const signer2b = ethers.Wallet.createRandom()
          const signer2c = ethers.Wallet.createRandom()

          const simpleConfig2 = {
            threshold: 6,
            checkpoint: await account.status(0).then((s) => ethers.BigNumber.from(s.checkpoint).add(1)),
            signers: [{
              address: signer2a.address,
              weight: 3
            }, {
              address: signer2b.address,
              weight: 3
            }, {
              address: signer2c.address,
              weight: 3
            }]
          }

          const ogOnchainImageHash = await account.status(0).then((s) => s.onChain.imageHash)
          const imageHash1 = await account.status(0).then((s) => s.imageHash)

          const config2 = v2.config.ConfigCoder.fromSimple(simpleConfig2)
          await account.updateConfig(config2)

          const status1 = await account.status(networks[0].chainId)
          const status2 = await account.status(networks[1].chainId)

          expect(status1.fullyMigrated).to.be.true
          expect(status1.onChain.deployed).to.be.true
          expect(status1.onChain.imageHash).to.equal(imageHash1)
          expect(status1.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(config2))
          expect(status1.presignedConfigurations.length).to.equal(1)

          expect(status2.fullyMigrated).to.be.true
          expect(status2.onChain.deployed).to.be.false
          expect(status2.onChain.imageHash).to.equal(ogOnchainImageHash)
          expect(status2.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(config2))
          expect(status2.presignedConfigurations.length).to.equal(2)
        })
      })
    })
  })

  describe('Migrated wallet', () => {
    it('Should migrate undeployed account', async () => {
      // Old account may be an address that's not even deployed
      const signer1 = ethers.Wallet.createRandom()

      const simpleConfig = {
        threshold: 1,
        checkpoint: 0,
        signers: [{
          address: signer1.address,
          weight: 1
        }]
      }

      const config = v1.config.ConfigCoder.fromSimple(simpleConfig)
      const configv2 = v2.config.ConfigCoder.fromSimple(simpleConfig)

      const imageHash = v1.config.ConfigCoder.imageHashOf(config)
      const address = commons.context.addressOf(contexts[1], imageHash)

      // Sessions server MUST have information about the old wallet
      // in production this is retrieved from SequenceUtils contract
      await tracker.saveCounterFactualWallet({ imageHash, context: [contexts[1]] })
      await tracker.saveWalletConfig({ config })

      // Importing the account should work!
      const account = new Account({ ...defaultArgs, address, orchestrator: new Orchestrator([signer1]) })

      const status = await account.status(0)
      expect(status.fullyMigrated).to.be.false
      expect(status.onChain.deployed).to.be.false
      expect(status.onChain.imageHash).to.equal(imageHash)
      expect(status.imageHash).to.equal(imageHash)
      expect(status.version).to.equal(1)

      // Sending a transaction should fail (not fully migrated)
      await expect(account.sendTransaction([], networks[0].chainId)).to.be.rejected

      // Should sign migration using the account
      await account.signAllMigrations()

      const status2 = await account.status(networks[0].chainId)
      expect(status2.fullyMigrated).to.be.true
      expect(status2.onChain.deployed).to.be.false
      expect(status2.onChain.imageHash).to.equal(imageHash)
      expect(status2.onChain.version).to.equal(1)
      expect(status2.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status2.version).to.equal(2)

      // Send a transaction
      const tx = await account.sendTransaction([], networks[0].chainId)
      expect(tx).to.not.be.undefined

      const status3 = await account.status(networks[0].chainId)
      expect(status3.fullyMigrated).to.be.true
      expect(status3.onChain.deployed).to.be.true
      expect(status3.onChain.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status3.onChain.version).to.equal(2)
      expect(status3.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status3.version).to.equal(2)

      // Send another transaction on another chain
      const tx2 = await account.sendTransaction([], networks[1].chainId)
      expect(tx2).to.not.be.undefined

      const status4 = await account.status(networks[1].chainId)
      expect(status4.fullyMigrated).to.be.true
      expect(status4.onChain.deployed).to.be.true
      expect(status4.onChain.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status4.onChain.version).to.equal(2)
      expect(status4.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status4.version).to.equal(2)
    })

    it('Should migrate a half-deployed account', async () => {
      // Old account created with 3 signers, and already deployed
      // in one of the chains
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      const signer3 = ethers.Wallet.createRandom()

      const simpleConfig = {
        threshold: 2,
        checkpoint: 0,
        signers: [{
          address: signer1.address,
          weight: 1
        }, {
          address: signer2.address,
          weight: 1
        }, {
          address: signer3.address,
          weight: 1
        }]
      }

      const config = v1.config.ConfigCoder.fromSimple(simpleConfig)
      const imageHash = v1.config.ConfigCoder.imageHashOf(config)
      const address = commons.context.addressOf(contexts[1], imageHash)

      // Deploy the wallet on network 0
      const deployTx = Wallet.buildDeployTransaction(contexts[1], imageHash)
      await (networks[0].relayer! as Relayer).relay({
        ...deployTx,
        chainId: networks[0].chainId,
        intent: {
          id: '0x00',
          wallet: address
        }
      })

      // Feed all information to sequence-sessions
      // (on prod this would be imported from SequenceUtils)
      await tracker.saveCounterFactualWallet({ imageHash, context: Object.values(contexts) })
      await tracker.saveWalletConfig({ config })

      // Importing the account should work!
      const account = new Account({
        ...defaultArgs,
        address,
        orchestrator: new Orchestrator([signer1, signer3])
      })

      // Status on network 0 should be deployed, network 1 not
      // both should not be migrated, and use the original imageHash
      const status1 = await account.status(networks[0].chainId)
      expect(status1.fullyMigrated).to.be.false
      expect(status1.onChain.deployed).to.be.true
      expect(status1.onChain.imageHash).to.equal(imageHash)
      expect(status1.onChain.version).to.equal(1)
      expect(status1.imageHash).to.equal(imageHash)
      expect(status1.version).to.equal(1)

      const status2 = await account.status(networks[1].chainId)
      expect(status2.fullyMigrated).to.be.false
      expect(status2.onChain.deployed).to.be.false
      expect(status2.onChain.imageHash).to.equal(imageHash)
      expect(status2.onChain.version).to.equal(1)
      expect(status2.imageHash).to.equal(imageHash)
      expect(status2.version).to.equal(1)

      // Signing transactions (on both networks) and signing messages should fail
      await expect(account.sendTransaction([], networks[0].chainId)).to.be.rejected
      await expect(account.sendTransaction([], networks[1].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[0].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[1].chainId)).to.be.rejected

      await account.signAllMigrations()

      // Sign a transaction on network 0 and network 1, both should work
      // and should take the wallet on-chain up to speed
      const configv2 = v2.config.ConfigCoder.fromSimple(simpleConfig)

      const tx1 = await account.sendTransaction([], networks[0].chainId)
      expect(tx1).to.not.be.undefined

      const status1b = await account.status(networks[0].chainId)
      expect(status1b.fullyMigrated).to.be.true
      expect(status1b.onChain.deployed).to.be.true
      expect(status1b.onChain.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status1b.onChain.version).to.equal(2)
      expect(status1b.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status1b.version).to.equal(2)

      const tx2 = await account.sendTransaction([], networks[1].chainId)
      expect(tx2).to.not.be.undefined

      const status2b = await account.status(networks[1].chainId)
      expect(status2b).to.be.deep.equal(status1b)
    })

    it('Should migrate an upgraded wallet', async () => {
      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      const signer3 = ethers.Wallet.createRandom()
      const signer4 = ethers.Wallet.createRandom()

      const simpleConfig1a = {
        threshold: 3,
        checkpoint: 0,
        signers: [{
          address: signer1.address,
          weight: 2
        }, {
          address: signer2.address,
          weight: 2
        }, {
          address: signer3.address,
          weight: 2
        }]
      }

      const config1a = v1.config.ConfigCoder.fromSimple(simpleConfig1a)
      const imageHash1a = v1.config.ConfigCoder.imageHashOf(config1a)
      const address = commons.context.addressOf(contexts[1], imageHash1a)

      const simpleConfig1b = {
        threshold: 3,
        checkpoint: 0,
        signers: [{
          address: signer1.address,
          weight: 2
        }, {
          address: signer2.address,
          weight: 2
        }, {
          address: signer4.address,
          weight: 2
        }]
      }

      const config1b = v1.config.ConfigCoder.fromSimple(simpleConfig1b)
      const imageHash1b = v1.config.ConfigCoder.imageHashOf(config1b)

      // Update wallet to config 1b (on network 0)
      const wallet = new Wallet({
        coders: {
          signature: v1.signature.SignatureCoder,
          config: v1.config.ConfigCoder
        },
        context: contexts[1],
        config: config1a,
        chainId: networks[0].chainId,
        address,
        orchestrator: new Orchestrator([signer1, signer3]),
        relayer: (networks[0].relayer as Relayer)!,
        provider: networks[0].provider!
      })

      const utx = await wallet.buildUpdateConfigurationTransaction(config1b)
      const signed = await wallet.signTransactionBundle(utx)
      const decorated = await wallet.decorateTransactions(signed)
      await (networks[0].relayer as Relayer).relay(decorated)

      // Importing the account should work!
      const account = new Account({
        ...defaultArgs,
        address,
        orchestrator: new Orchestrator([signer1, signer3])
      })

      // Feed the tracker with all the data
      await tracker.saveCounterFactualWallet({ imageHash: imageHash1a, context: [contexts[1]] })
      await tracker.saveWalletConfig({ config: config1b })
      await tracker.saveWalletConfig({ config: config1a })

      // Status on network 0 should be deployed, network 1 not
      // and the configuration on network 0 should be the B one
      const status1 = await account.status(networks[0].chainId)
      expect(status1.fullyMigrated).to.be.false
      expect(status1.onChain.deployed).to.be.true
      expect(status1.onChain.imageHash).to.equal(imageHash1b)
      expect(status1.onChain.version).to.equal(1)
      expect(status1.imageHash).to.equal(imageHash1b)

      const status2 = await account.status(networks[1].chainId)
      expect(status2.fullyMigrated).to.be.false
      expect(status2.onChain.deployed).to.be.false
      expect(status2.onChain.imageHash).to.equal(imageHash1a)
      expect(status2.onChain.version).to.equal(1)
      expect(status2.imageHash).to.equal(imageHash1a)

      // Signing transactions (on both networks) and signing messages should fail
      await expect(account.sendTransaction([], networks[0].chainId)).to.be.rejected
      await expect(account.sendTransaction([], networks[1].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[0].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[1].chainId)).to.be.rejected

      // Sign all migrations should only have signers1 and 2
      // so the migration should only be available on network 1 (the one not updated)
      await account.signAllMigrations()

      const config2a = v2.config.ConfigCoder.fromSimple(simpleConfig1a)
      const config2b = v2.config.ConfigCoder.fromSimple(simpleConfig1b)
      const imageHash2a = v2.config.ConfigCoder.imageHashOf(config2a)

      const status1b = await account.status(networks[0].chainId)
      expect(status1b.fullyMigrated).to.be.false
      expect(status1b.onChain.deployed).to.be.true
      expect(status1b.onChain.imageHash).to.equal(imageHash1b)
      expect(status1b.onChain.version).to.equal(1)
      expect(status1b.imageHash).to.equal(imageHash1b)
      expect(status1b.version).to.equal(1)

      const status2b = await account.status(networks[1].chainId)
      expect(status2b.fullyMigrated).to.be.true
      expect(status2b.onChain.deployed).to.be.false
      expect(status2b.onChain.imageHash).to.equal(imageHash1a)
      expect(status2b.onChain.version).to.equal(1)
      expect(status2b.imageHash).to.equal(imageHash2a)
      expect(status2b.version).to.equal(2)

      // Sending a transaction should work for network 1
      // but fail for network 0, same with signing messages
      await expect(account.sendTransaction([], networks[0].chainId)).to.be.rejected
      await expect(account.sendTransaction([], networks[1].chainId)).to.be.fulfilled

      await expect(account.signMessage('0x00', networks[0].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[1].chainId)).to.be.fulfilled

      // Signing another migration with signers1 and 2 should put both in sync
      account.setOrchestrator(new Orchestrator([signer1, signer2]))
      await account.signAllMigrations()

      await expect(account.sendTransaction([], networks[0].chainId)).to.be.fulfilled
      await expect(account.sendTransaction([], networks[1].chainId)).to.be.fulfilled

      await expect(account.signMessage('0x00', networks[0].chainId)).to.be.fulfilled
      await expect(account.signMessage('0x00', networks[1].chainId)).to.be.fulfilled

      const status1c = await account.status(networks[0].chainId)
      const status2c = await account.status(networks[1].chainId)

      expect(status1c.fullyMigrated).to.be.true
      expect(status2c.fullyMigrated).to.be.true

      // Configs are still different!
      expect(status1c.imageHash).to.not.equal(status2c.imageHash)

      const simpleConfig4 = {
        threshold: 2,
        checkpoint: 1,
        signers: [{
          address: signer1.address,
          weight: 1
        }, {
          address: signer2.address,
          weight: 1
        }, {
          address: signer4.address,
          weight: 1
        }]
      }

      const config4 = v2.config.ConfigCoder.fromSimple(simpleConfig4)

      await account.updateConfig(config4)

      const status1d = await account.status(networks[0].chainId)
      const status2d = await account.status(networks[1].chainId)

      // Configs are now the same!
      expect(status1d.imageHash).to.be.equal(status2d.imageHash)
    })
  })
})
