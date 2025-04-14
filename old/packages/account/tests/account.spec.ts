import { walletContracts } from '@0xsequence/abi'
import { commons, v1, v2 } from '@0xsequence/core'
import type { migrator } from '@0xsequence/migration'
import type { NetworkConfig } from '@0xsequence/network'
import { LocalRelayer, Relayer } from '@0xsequence/relayer'
import { tracker, trackers } from '@0xsequence/sessions'
import { Orchestrator } from '@0xsequence/signhub'
import * as utils from '@0xsequence/tests'
import { Wallet } from '@0xsequence/wallet'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { concat, ethers, MessagePrefix, toUtf8Bytes } from 'ethers'
import hardhat from 'hardhat'

import { Account } from '../src/account'
import { AccountOrchestratorWrapper } from '../src/orchestrator/wrapper'

const { expect } = chai.use(chaiAsPromised)

const deterministic = false

describe('Account', () => {
  let provider1: ethers.BrowserProvider
  let provider2: ethers.JsonRpcProvider

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

  let defaultTx: commons.transaction.Transaction

  const createNestedAccount = async (entropy: string, bootstrapInner = true, bootstrapOuter = true) => {
    const signer = randomWallet(entropy)

    const configInner = {
      threshold: 1,
      checkpoint: Math.floor(now() / 1000),
      signers: [{ address: signer.address, weight: 1 }]
    }
    const accountInner = await Account.new({
      ...defaultArgs,
      config: configInner,
      orchestrator: new Orchestrator([signer])
    })
    if (bootstrapInner) {
      await accountInner.doBootstrap(networks[0].chainId)
    }

    const configOuter = {
      threshold: 1,
      checkpoint: Math.floor(now() / 1000),
      signers: [{ address: accountInner.address, weight: 1 }]
    }
    const accountOuter = await Account.new({
      ...defaultArgs,
      config: configOuter,
      orchestrator: new Orchestrator([new AccountOrchestratorWrapper(accountInner)])
    })
    if (bootstrapOuter) {
      await accountOuter.doBootstrap(networks[0].chainId)
    }

    return { signer, accountInner, accountOuter }
  }

  const getEth = async (address: string, signer?: ethers.Signer) => {
    if (signer === undefined) {
      // Do both networks
      await getEth(address, signer1)
      await getEth(address, signer2)
      return
    }
    // Signer sends the address some ETH for defaultTx use
    const tx = await signer.sendTransaction({
      to: address,
      value: 10 // Should be plenty
    })
    await tx.wait()
  }

  before(async () => {
    provider1 = new ethers.BrowserProvider(hardhat.network.provider as any, undefined, { cacheTimeout: -1 })
    provider2 = new ethers.JsonRpcProvider('http://127.0.0.1:7048', undefined, { cacheTimeout: -1 })

    // TODO: Implement migrations on local config tracker
    tracker = new trackers.local.LocalConfigTracker(provider1)

    signer1 = await provider1.getSigner()
    signer2 = await provider2.getSigner()

    networks = [
      {
        chainId: 31337,
        name: 'hardhat',
        provider: provider1,
        rpcUrl: '',
        relayer: new LocalRelayer(signer1),
        nativeToken: {
          symbol: 'ETH',
          name: 'Ether',
          decimals: 18
        }
      },
      {
        chainId: 31338,
        name: 'hardhat2',
        provider: provider2,
        rpcUrl: 'http://127.0.0.1:7048',
        relayer: new LocalRelayer(signer2),
        nativeToken: {
          symbol: 'ETH',
          name: 'Ether',
          decimals: 18
        }
      }
    ]

    const context1 = utils.context.deploySequenceContexts(signer1)
    const context2 = utils.context.deploySequenceContexts(signer2)
    expect(await context1).to.deep.equal(await context2)
    contexts = await context1

    defaultArgs = {
      contexts,
      networks,
      tracker
    }

    defaultTx = {
      to: await signer1.getAddress(),
      value: 1
    }
  })

  describe('New account', () => {
    it('Should create a new account', async () => {
      const signer = randomWallet('Should create a new account')
      const config = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer])
      })

      expect(account).to.be.instanceOf(Account)
      expect(account.address).to.not.be.undefined

      await getEth(account.address)
      const tx = await account.sendTransaction([defaultTx], networks[0].chainId)
      expect(tx).to.not.be.undefined

      const status = await account.status(networks[0].chainId)
      expect(status.fullyMigrated).to.be.true
      expect(status.onChain.deployed).to.be.true
      expect(status.onChain.version).to.equal(2)
    })

    it('Should create new nested accounts', async () => {
      const { accountInner, accountOuter } = await createNestedAccount('create new nested accounts', false, false)

      await getEth(accountOuter.address)
      await accountOuter.sendTransaction([defaultTx], networks[0].chainId)

      const statusOuter = await accountOuter.status(networks[0].chainId)

      expect(statusOuter.fullyMigrated).to.be.true
      expect(statusOuter.onChain.deployed).to.be.true
      expect(statusOuter.onChain.version).to.equal(2)

      const statusInner = await accountInner.status(networks[0].chainId)
      expect(statusInner.fullyMigrated).to.be.true
      expect(statusInner.onChain.deployed).to.be.true
      expect(statusInner.onChain.version).to.equal(2)
    })

    it('Should send tx on nested accounts', async () => {
      const { accountInner, accountOuter } = await createNestedAccount('sent tx on nested accounts', true, true)

      await getEth(accountOuter.address)
      await accountOuter.sendTransaction([defaultTx], networks[0].chainId)

      const statusOuter = await accountOuter.status(networks[0].chainId)

      expect(statusOuter.fullyMigrated).to.be.true
      expect(statusOuter.onChain.deployed).to.be.true
      expect(statusOuter.onChain.version).to.equal(2)

      const statusInner = await accountInner.status(networks[0].chainId)
      expect(statusInner.fullyMigrated).to.be.true
      expect(statusInner.onChain.deployed).to.be.true
      expect(statusInner.onChain.version).to.equal(2)
    })

    it('Should send transactions on multiple networks', async () => {
      const signer = randomWallet('Should send transactions on multiple networks')
      const config = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer])
      })

      await getEth(account.address)
      await account.sendTransaction([defaultTx], networks[0].chainId)
      await account.sendTransaction([defaultTx], networks[1].chainId)

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
      const signers = new Array(24).fill(0).map(() => randomWallet('Should create a new account with many signers'))
      const config = {
        threshold: 3,
        checkpoint: Math.floor(now() / 1000),
        signers: signers.map(signer => ({
          address: signer.address,
          weight: 1
        }))
      }

      const rsigners = signers.sort(() => randomFraction('Should create a new account with many signers 2') - 0.5)
      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator(rsigners.slice(0, 4))
      })

      await getEth(account.address)
      await account.sendTransaction([defaultTx], networks[0].chainId)

      const status = await account.status(networks[0].chainId)
      expect(status.fullyMigrated).to.be.true
      expect(status.onChain.deployed).to.be.true
      expect(status.onChain.version).to.equal(2)
    })

    it('Should sign and validate a message', async () => {
      const signer = randomWallet('Should sign and validate a message')
      const config = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer])
      })

      await account.doBootstrap(networks[0].chainId)

      const msg = ethers.toUtf8Bytes('Hello World')
      const sig = await account.signMessage(msg, networks[0].chainId)

      const valid = await commons.EIP1271.isValidEIP1271Signature(
        account.address,
        ethers.hashMessage(msg),
        sig,
        networks[0].provider!
      )

      expect(valid).to.be.true
    })

    it('Should sign and validate a message with nested account', async () => {
      const { accountOuter } = await createNestedAccount('sign and validate nested')

      const msg = ethers.toUtf8Bytes('Hello World')
      const sig = await accountOuter.signMessage(msg, networks[0].chainId)

      const valid = await commons.EIP1271.isValidEIP1271Signature(
        accountOuter.address,
        ethers.hashMessage(msg),
        sig,
        networks[0].provider!
      )

      expect(valid).to.be.true
    })

    it('Should update account to new configuration', async () => {
      const signer = randomWallet('Should update account to new configuration')
      const simpleConfig1 = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }
      const config1 = v2.config.ConfigCoder.fromSimple(simpleConfig1)

      const account = await Account.new({
        ...defaultArgs,
        config: simpleConfig1,
        orchestrator: new Orchestrator([signer])
      })

      const signer2a = randomWallet('Should update account to new configuration 2')
      const signer2b = randomWallet('Should update account to new configuration 3')

      const simpleConfig2 = {
        threshold: 4,
        checkpoint: Math.floor(now() / 1000) + 1,
        signers: [
          {
            address: signer2a.address,
            weight: 2
          },
          {
            address: signer2b.address,
            weight: 2
          }
        ]
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

    it('Should sign and validate a message without being deployed', async () => {
      const signer = randomWallet('Should sign and validate a message without being deployed')
      const config = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer])
      })

      const msg = ethers.toUtf8Bytes('Hello World')
      const sig = await account.signMessage(msg, networks[0].chainId, 'eip6492')

      const valid = await account.reader(networks[0].chainId).isValidSignature(account.address, ethers.hashMessage(msg), sig)

      expect(valid).to.be.true
    })

    it('Should sign and validate a message without being deployed with nested account', async () => {
      const { accountOuter } = await createNestedAccount('sign and validate nested undeployed', true, false)

      const msg = ethers.toUtf8Bytes('Hello World')
      const sig = await accountOuter.signMessage(msg, networks[0].chainId, 'eip6492')

      const valid = await accountOuter
        .reader(networks[0].chainId)
        .isValidSignature(accountOuter.address, ethers.hashMessage(msg), sig)

      expect(valid).to.be.true
    })

    it('Should sign and validate a message with undeployed nested account and signer', async () => {
      // Testing that an undeployed account doesn't error as other signer can satisfy threshold
      const signerA = randomWallet('Nested account signer A')
      const signerB = randomWallet('Nested account signer B')

      const configInner = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signerA.address, weight: 1 }]
      }
      const accountInner = await Account.new({
        ...defaultArgs,
        config: configInner,
        orchestrator: new Orchestrator([signerA])
      }) // Undeployed

      const configOuter = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [
          { address: accountInner.address, weight: 1 },
          { address: signerB.address, weight: 1 }
        ]
      }
      const accountOuter = await Account.new({
        ...defaultArgs,
        config: configOuter,
        orchestrator: new Orchestrator([new AccountOrchestratorWrapper(accountInner), signerB])
      })
      await accountOuter.doBootstrap(networks[0].chainId)

      const msg = ethers.toUtf8Bytes('Hello World')
      const sig = await accountOuter.signMessage(msg, networks[0].chainId)

      const valid = await accountOuter
        .reader(networks[0].chainId)
        .isValidSignature(accountOuter.address, ethers.hashMessage(msg), sig)

      expect(valid).to.be.true
    })

    it('Should refuse to sign when not deployed', async () => {
      const signer = randomWallet('Should refuse to sign when not deployed')
      const config = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      const account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer])
      })

      const msg = ethers.toUtf8Bytes('Hello World')
      const sig = account.signMessage(msg, networks[0].chainId, 'throw')

      expect(sig).to.be.rejected
    })

    it('Should refuse to sign when not deployed (nested)', async () => {
      const { accountOuter } = await createNestedAccount('refuse to sign undeployed', false, false)

      const msg = ethers.toUtf8Bytes('Hello World')
      const sig = accountOuter.signMessage(msg, networks[0].chainId, 'eip6492') // Note EIP-6492 throws when nested not deployed

      expect(sig).to.be.rejected
    })

    describe('After upgrading', () => {
      let account: Account

      let signer1: ethers.Wallet
      let signer2a: ethers.Wallet
      let signer2b: ethers.Wallet
      let signerIndex = 1

      beforeEach(async () => {
        signer1 = randomWallet(`After upgrading ${signerIndex++}`)
        const simpleConfig1 = {
          threshold: 1,
          checkpoint: Math.floor(now() / 1000) + 1,
          signers: [{ address: signer1.address, weight: 1 }]
        }

        account = await Account.new({
          ...defaultArgs,
          config: simpleConfig1,
          orchestrator: new Orchestrator([signer1])
        })
        await getEth(account.address)

        signer2a = randomWallet(`After upgrading ${signerIndex++}`)
        signer2b = randomWallet(`After upgrading ${signerIndex++}`)

        const simpleConfig2 = {
          threshold: 4,
          checkpoint: await account.status(0).then(s => BigInt(s.checkpoint) + 1n),
          signers: [
            {
              address: signer2a.address,
              weight: 2
            },
            {
              address: signer2b.address,
              weight: 2
            }
          ]
        }

        const config2 = v2.config.ConfigCoder.fromSimple(simpleConfig2)
        await account.updateConfig(config2)
        account.setOrchestrator(new Orchestrator([signer2a, signer2b]))
      })

      it('Should send a transaction', async () => {
        const tx = await account.sendTransaction([defaultTx], networks[0].chainId)
        expect(tx).to.not.be.undefined

        const status = await account.status(networks[0].chainId)
        expect(status.fullyMigrated).to.be.true
        expect(status.onChain.deployed).to.be.true
        expect(status.onChain.imageHash).to.equal(status.imageHash)
      })

      it('Should send a transaction on nested account', async () => {
        const configOuter = {
          threshold: 1,
          checkpoint: Math.floor(now() / 1000),
          signers: [{ address: account.address, weight: 1 }]
        }
        const accountOuter = await Account.new({
          ...defaultArgs,
          config: configOuter,
          orchestrator: new Orchestrator([new AccountOrchestratorWrapper(account)])
        })

        await accountOuter.doBootstrap(networks[0].chainId)

        const tx = await accountOuter.sendTransaction([], networks[0].chainId)
        expect(tx).to.not.be.undefined

        const statusOuter = await accountOuter.status(networks[0].chainId)
        expect(statusOuter.fullyMigrated).to.be.true
        expect(statusOuter.onChain.deployed).to.be.true
        expect(statusOuter.onChain.imageHash).to.equal(statusOuter.imageHash)

        const status = await account.status(networks[0].chainId)
        expect(status.fullyMigrated).to.be.true
        expect(status.onChain.deployed).to.be.true
        expect(status.onChain.imageHash).to.equal(status.imageHash)
      })

      it('Should send a transaction on undeployed nested account', async () => {
        const configOuter = {
          threshold: 1,
          checkpoint: Math.floor(now() / 1000),
          signers: [{ address: account.address, weight: 1 }]
        }
        const accountOuter = await Account.new({
          ...defaultArgs,
          config: configOuter,
          orchestrator: new Orchestrator([new AccountOrchestratorWrapper(account)])
        })

        await getEth(accountOuter.address)
        const tx = await accountOuter.sendTransaction([defaultTx], networks[0].chainId)
        expect(tx).to.not.be.undefined

        const status = await account.status(networks[0].chainId)
        expect(status.fullyMigrated).to.be.true
        expect(status.onChain.deployed).to.be.true
        expect(status.onChain.imageHash).to.equal(status.imageHash)
      })

      it('Should sign a message', async () => {
        const msg = ethers.toUtf8Bytes('Hello World')
        const sig = await account.signMessage(msg, networks[0].chainId)

        const canOnchainValidate = await account.status(networks[0].chainId).then(s => s.canOnchainValidate)
        expect(canOnchainValidate).to.be.false
        await account.doBootstrap(networks[0].chainId)

        const valid = await commons.EIP1271.isValidEIP1271Signature(
          account.address,
          ethers.hashMessage(msg),
          sig,
          networks[0].provider!
        )

        expect(valid).to.be.true
      })

      it('Should sign a message, already prefixed with EIP-191', async () => {
        const msg = ethers.toUtf8Bytes('Hello World')

        const prefixedMessage = concat([
          toUtf8Bytes(MessagePrefix),
          toUtf8Bytes(String(msg.length)),
          msg
        ])
        
        const sig = await account.signMessage(prefixedMessage, networks[0].chainId)

        const canOnchainValidate = await account.status(networks[0].chainId).then(s => s.canOnchainValidate)
        expect(canOnchainValidate).to.be.false
        await account.doBootstrap(networks[0].chainId)

        const valid = await commons.EIP1271.isValidEIP1271Signature(
          account.address,
          ethers.hashMessage(msg),
          sig,
          networks[0].provider!
        )

        expect(valid).to.be.true
      })

      it('Should fail to use old signer', async () => {
        account.setOrchestrator(new Orchestrator([signer1]))
        const tx = account.sendTransaction([defaultTx], networks[0].chainId)
        await expect(tx).to.be.rejected
      })

      it('Should send a transaction on a different network', async () => {
        const tx = await account.sendTransaction([defaultTx], networks[1].chainId)
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
          await getEth(account.address)
        })

        it('Should send a transaction', async () => {
          const tx = await account.sendTransaction([defaultTx], networks[0].chainId)
          expect(tx).to.not.be.undefined

          const status = await account.status(networks[0].chainId)
          expect(status.fullyMigrated).to.be.true
          expect(status.onChain.deployed).to.be.true
          expect(status.onChain.imageHash).to.equal(status.imageHash)
        })

        it('Should sign a message', async () => {
          const msg = ethers.toUtf8Bytes('Hello World')
          const sig = await account.signMessage(msg, networks[0].chainId)

          const canOnchainValidate = await account.status(networks[0].chainId).then(s => s.canOnchainValidate)
          expect(canOnchainValidate).to.be.false
          await account.doBootstrap(networks[0].chainId)

          const valid = await commons.EIP1271.isValidEIP1271Signature(
            account.address,
            ethers.hashMessage(msg),
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
        let signerIndex = 1

        let config3: v2.config.WalletConfig

        beforeEach(async () => {
          signer3a = randomWallet(`After updating the config again ${signerIndex++}`)
          signer3b = randomWallet(`After updating the config again ${signerIndex++}`)
          signer3c = randomWallet(`After updating the config again ${signerIndex++}`)

          const simpleConfig3 = {
            threshold: 5,
            checkpoint: await account.status(0).then(s => BigInt(s.checkpoint) + 1n),
            signers: [
              {
                address: signer3a.address,
                weight: 2
              },
              {
                address: signer3b.address,
                weight: 2
              },
              {
                address: signer3c.address,
                weight: 1
              }
            ]
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
          const tx = await account.sendTransaction([defaultTx], networks[0].chainId)
          expect(tx).to.not.be.undefined

          const status = await account.status(networks[0].chainId)
          expect(status.fullyMigrated).to.be.true
          expect(status.onChain.deployed).to.be.true
          expect(status.onChain.imageHash).to.equal(status.imageHash)
        })

        it('Should sign a message', async () => {
          const msg = ethers.toUtf8Bytes('Hello World')
          const sig = await account.signMessage(msg, networks[0].chainId)

          const canOnchainValidate = await account.status(networks[0].chainId).then(s => s.canOnchainValidate)
          expect(canOnchainValidate).to.be.false
          await account.doBootstrap(networks[0].chainId)

          const status = await account.status(networks[0].chainId)
          expect(status.onChain.imageHash).to.not.equal(status.imageHash)

          const valid = await commons.EIP1271.isValidEIP1271Signature(
            account.address,
            ethers.hashMessage(msg),
            sig,
            networks[0].provider!
          )

          expect(valid).to.be.true
        })
      })

      describe('After sending a transaction', () => {
        beforeEach(async () => {
          await account.sendTransaction([defaultTx], networks[0].chainId)
        })

        it('Should send a transaction in a different network', async () => {
          const tx = await account.sendTransaction([defaultTx], networks[1].chainId)
          expect(tx).to.not.be.undefined

          const status = await account.status(networks[1].chainId)
          expect(status.fullyMigrated).to.be.true
          expect(status.onChain.deployed).to.be.true
          expect(status.onChain.imageHash).to.equal(status.imageHash)
        })

        it('Should send a second transaction', async () => {
          const tx = await account.sendTransaction([defaultTx], networks[0].chainId)
          expect(tx).to.not.be.undefined
        })

        let signerIndex = 1
        it('Should update the configuration again', async () => {
          const signer2a = randomWallet(`Should update the configuration again ${signerIndex++}`)
          const signer2b = randomWallet(`Should update the configuration again ${signerIndex++}`)
          const signer2c = randomWallet(`Should update the configuration again ${signerIndex++}`)

          const simpleConfig2 = {
            threshold: 6,
            checkpoint: await account.status(0).then(s => BigInt(s.checkpoint) + 1n),
            signers: [
              {
                address: signer2a.address,
                weight: 3
              },
              {
                address: signer2b.address,
                weight: 3
              },
              {
                address: signer2c.address,
                weight: 3
              }
            ]
          }

          const ogOnchainImageHash = await account.status(0).then(s => s.onChain.imageHash)
          const imageHash1 = await account.status(0).then(s => s.imageHash)

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
      const signer1 = randomWallet('Should migrate undeployed account')

      const simpleConfig: commons.config.SimpleConfig = {
        threshold: 1,
        checkpoint: 0,
        signers: [
          {
            address: signer1.address,
            weight: 1
          }
        ]
      }

      const config = v1.config.ConfigCoder.fromSimple(simpleConfig)
      const configv2 = v2.config.ConfigCoder.fromSimple(simpleConfig)

      const imageHash = v1.config.ConfigCoder.imageHashOf(config)
      const address = commons.context.addressOf(contexts[1], imageHash)

      // Sessions server MUST have information about the old wallet
      // in production this is retrieved from SequenceUtils contract
      await tracker.saveCounterfactualWallet({ config, context: [contexts[1]] })

      // Importing the account should work!
      const account = new Account({ ...defaultArgs, address, orchestrator: new Orchestrator([signer1]) })

      const status = await account.status(0)
      expect(status.fullyMigrated).to.be.false
      expect(status.onChain.deployed).to.be.false
      expect(status.onChain.imageHash).to.equal(imageHash)
      expect(status.imageHash).to.equal(imageHash)
      expect(status.version).to.equal(1)

      // Sending a transaction should fail (not fully migrated)
      await getEth(account.address)
      await expect(account.sendTransaction([defaultTx], networks[0].chainId)).to.be.rejected

      // Should sign migration using the account
      await account.signAllMigrations(c => c)

      const status2 = await account.status(networks[0].chainId)
      expect(status2.fullyMigrated).to.be.true
      expect(status2.onChain.deployed).to.be.false
      expect(status2.onChain.imageHash).to.equal(imageHash)
      expect(status2.onChain.version).to.equal(1)
      expect(status2.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status2.version).to.equal(2)

      // Send a transaction
      const tx = await account.sendTransaction([defaultTx], networks[0].chainId)
      expect(tx).to.not.be.undefined

      const status3 = await account.status(networks[0].chainId)
      expect(status3.fullyMigrated).to.be.true
      expect(status3.onChain.deployed).to.be.true
      expect(status3.onChain.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status3.onChain.version).to.equal(2)
      expect(status3.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status3.version).to.equal(2)

      // Send another transaction on another chain
      const tx2 = await account.sendTransaction([defaultTx], networks[1].chainId)
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
      const signer1 = randomWallet('Should migrate a half-deployed account')
      const signer2 = randomWallet('Should migrate a half-deployed account 2')
      const signer3 = randomWallet('Should migrate a half-deployed account 3')

      const simpleConfig = {
        threshold: 2,
        checkpoint: 0,
        signers: [
          {
            address: signer1.address,
            weight: 1
          },
          {
            address: signer2.address,
            weight: 1
          },
          {
            address: signer3.address,
            weight: 1
          }
        ]
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
      await tracker.saveCounterfactualWallet({ config, context: Object.values(contexts) })

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
      await getEth(account.address)
      await expect(account.sendTransaction([defaultTx], networks[0].chainId)).to.be.rejected
      await expect(account.sendTransaction([defaultTx], networks[1].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[0].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[1].chainId)).to.be.rejected

      await account.signAllMigrations(c => c)

      // Sign a transaction on network 0 and network 1, both should work
      // and should take the wallet on-chain up to speed
      const configv2 = v2.config.ConfigCoder.fromSimple(simpleConfig)

      const tx1 = await account.sendTransaction([defaultTx], networks[0].chainId)
      expect(tx1).to.not.be.undefined
      await tx1!.wait()

      const status1b = await account.status(networks[0].chainId)
      expect(status1b.fullyMigrated).to.be.true
      expect(status1b.onChain.deployed).to.be.true
      expect(status1b.onChain.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status1b.onChain.version).to.equal(2)
      expect(status1b.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status1b.version).to.equal(2)

      const tx2 = await account.sendTransaction([defaultTx], networks[1].chainId)
      expect(tx2).to.not.be.undefined

      const status2b = await account.status(networks[1].chainId)
      expect(status2b).to.be.deep.equal(status1b)
    })

    it('Should migrate an upgraded wallet', async () => {
      const signer1 = randomWallet('Should migrate an upgraded wallet')
      const signer2 = randomWallet('Should migrate an upgraded wallet 2')
      const signer3 = randomWallet('Should migrate an upgraded wallet 3')
      const signer4 = randomWallet('Should migrate an upgraded wallet 4')

      const simpleConfig1a = {
        threshold: 3,
        checkpoint: 0,
        signers: [
          {
            address: signer1.address,
            weight: 2
          },
          {
            address: signer2.address,
            weight: 2
          },
          {
            address: signer3.address,
            weight: 2
          }
        ]
      }

      const config1a = v1.config.ConfigCoder.fromSimple(simpleConfig1a)
      const imageHash1a = v1.config.ConfigCoder.imageHashOf(config1a)
      const address = commons.context.addressOf(contexts[1], imageHash1a)

      const simpleConfig1b = {
        threshold: 3,
        checkpoint: 0,
        signers: [
          {
            address: signer1.address,
            weight: 2
          },
          {
            address: signer2.address,
            weight: 2
          },
          {
            address: signer4.address,
            weight: 2
          }
        ]
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
      await tracker.saveCounterfactualWallet({ config: config1a, context: [contexts[1]] })
      await tracker.saveWalletConfig({ config: config1b })

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
      await getEth(account.address)
      await expect(account.sendTransaction([defaultTx], networks[0].chainId)).to.be.rejected
      await expect(account.sendTransaction([defaultTx], networks[1].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[0].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[1].chainId)).to.be.rejected

      // Sign all migrations should only have signers1 and 2
      // so the migration should only be available on network 1 (the one not updated)
      await account.signAllMigrations(c => c)

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
      await expect(account.sendTransaction([defaultTx], networks[0].chainId)).to.be.rejected
      await expect(account.sendTransaction([defaultTx], networks[1].chainId)).to.be.fulfilled

      await expect(account.signMessage('0x00', networks[0].chainId)).to.be.rejected
      await expect(account.signMessage('0x00', networks[1].chainId)).to.be.fulfilled

      // Signing another migration with signers1 and 2 should put both in sync
      account.setOrchestrator(new Orchestrator([signer1, signer2]))
      await account.signAllMigrations(c => c)

      await expect(account.sendTransaction([defaultTx], networks[0].chainId)).to.be.fulfilled
      await expect(account.sendTransaction([defaultTx], networks[1].chainId)).to.be.fulfilled

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
        signers: [
          {
            address: signer1.address,
            weight: 1
          },
          {
            address: signer2.address,
            weight: 1
          },
          {
            address: signer4.address,
            weight: 1
          }
        ]
      }

      const config4 = v2.config.ConfigCoder.fromSimple(simpleConfig4)

      await account.updateConfig(config4)

      const status1d = await account.status(networks[0].chainId)
      const status2d = await account.status(networks[1].chainId)

      // Configs are now the same!
      expect(status1d.imageHash).to.be.equal(status2d.imageHash)
    })

    it('Should edit the configuration during the migration', async () => {
      // Old account may be an address that's not even deployed
      const signer1 = randomWallet('Should edit the configuration during the migration')
      const signer2 = randomWallet('Should edit the configuration during the migration 2')

      const simpleConfig1 = {
        threshold: 1,
        checkpoint: 0,
        signers: [
          {
            address: signer1.address,
            weight: 1
          }
        ]
      }

      const simpleConfig2 = {
        threshold: 1,
        checkpoint: 0,
        signers: [
          {
            address: signer2.address,
            weight: 1
          }
        ]
      }

      const config = v1.config.ConfigCoder.fromSimple(simpleConfig1)
      const configv2 = v2.config.ConfigCoder.fromSimple(simpleConfig2)

      const imageHash = v1.config.ConfigCoder.imageHashOf(config)
      const address = commons.context.addressOf(contexts[1], imageHash)

      // Sessions server MUST have information about the old wallet
      // in production this is retrieved from SequenceUtils contract
      await tracker.saveCounterfactualWallet({ config, context: [contexts[1]] })

      // Importing the account should work!
      const orchestrator = new Orchestrator([signer1])
      const account = new Account({ ...defaultArgs, address, orchestrator: orchestrator })

      const status = await account.status(0)
      expect(status.fullyMigrated).to.be.false
      expect(status.onChain.deployed).to.be.false
      expect(status.onChain.imageHash).to.equal(imageHash)
      expect(status.imageHash).to.equal(imageHash)
      expect(status.version).to.equal(1)

      // Sending a transaction should fail (not fully migrated)
      await getEth(account.address)
      await expect(account.sendTransaction([defaultTx], networks[0].chainId)).to.be.rejected

      // Should sign migration using the account
      await account.signAllMigrations(c => {
        expect(v1.config.ConfigCoder.imageHashOf(c as any)).to.equal(v1.config.ConfigCoder.imageHashOf(config))
        return configv2
      })

      const status2 = await account.status(networks[0].chainId)
      expect(status2.fullyMigrated).to.be.true
      expect(status2.onChain.deployed).to.be.false
      expect(status2.onChain.imageHash).to.equal(imageHash)
      expect(status2.onChain.version).to.equal(1)
      expect(status2.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status2.version).to.equal(2)

      // Send a transaction
      orchestrator.setSigners([signer2])
      const tx = await account.sendTransaction([defaultTx], networks[0].chainId)
      expect(tx).to.not.be.undefined

      const status3 = await account.status(networks[0].chainId)
      expect(status3.fullyMigrated).to.be.true
      expect(status3.onChain.deployed).to.be.true
      expect(status3.onChain.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status3.onChain.version).to.equal(2)
      expect(status3.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status3.version).to.equal(2)

      // Send another transaction on another chain
      const tx2 = await account.sendTransaction([defaultTx], networks[1].chainId)
      expect(tx2).to.not.be.undefined

      const status4 = await account.status(networks[1].chainId)
      expect(status4.fullyMigrated).to.be.true
      expect(status4.onChain.deployed).to.be.true
      expect(status4.onChain.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status4.onChain.version).to.equal(2)
      expect(status4.imageHash).to.equal(v2.config.ConfigCoder.imageHashOf(configv2))
      expect(status4.version).to.equal(2)
    })

    context('Signing messages', async () => {
      context('After migrating', async () => {
        let account: Account
        let imageHash: string

        beforeEach(async () => {
          // Old account may be an address that's not even deployed
          const signer1 = randomWallet(
            // @ts-ignore
            'Signing messages - After migrating' + account?.address ?? '' // Append prev address to entropy to avoid collisions
          )

          const simpleConfig = {
            threshold: 1,
            checkpoint: 0,
            signers: [
              {
                address: signer1.address,
                weight: 1
              }
            ]
          }

          const config = v1.config.ConfigCoder.fromSimple(simpleConfig)
          imageHash = v1.config.ConfigCoder.imageHashOf(config)
          const address = commons.context.addressOf(contexts[1], imageHash)

          // Sessions server MUST have information about the old wallet
          // in production this is retrieved from SequenceUtils contract
          await tracker.saveCounterfactualWallet({ config, context: [contexts[1]] })

          account = new Account({ ...defaultArgs, address, orchestrator: new Orchestrator([signer1]) })

          // Should sign migration using the account
          await account.signAllMigrations(c => c)
        })

        it('Should validate a message signed by undeployed migrated wallet', async () => {
          const msg = ethers.toUtf8Bytes('I like that you are reading our tests')
          const sig = await account.signMessage(msg, networks[0].chainId, 'eip6492')

          const valid = await account.reader(networks[0].chainId).isValidSignature(account.address, ethers.hashMessage(msg), sig)

          expect(valid).to.be.true
        })

        it('Should reject a message signed by undeployed migrated wallet (if set the throw)', async () => {
          const msg = ethers.toUtf8Bytes('I do not know what to write here anymore')
          const sig = account.signMessage(msg, networks[0].chainId, 'throw')

          await expect(sig).to.be.rejected
        })

        it('Should return an invalid signature by undeployed migrated wallet (if set to ignore)', async () => {
          const msg = ethers.toUtf8Bytes('Sending a hug')
          const sig = await account.signMessage(msg, networks[0].chainId, 'ignore')

          const valid = await account.reader(networks[0].chainId).isValidSignature(account.address, ethers.hashMessage(msg), sig)

          expect(valid).to.be.false
        })

        it('Should validate a message signed by deployed migrated wallet (deployed with v1)', async () => {
          const deployTx = Wallet.buildDeployTransaction(contexts[1], imageHash)
          await signer1
            .sendTransaction({
              to: deployTx.entrypoint,
              data: commons.transaction.encodeBundleExecData(deployTx)
            })
            .then(t => t.wait())

          expect(await networks[0].provider!.getCode(account.address).then(c => ethers.getBytes(c).length)).to.not.equal(0)

          const msg = ethers.toUtf8Bytes('Everything seems to be working fine so far')
          const sig = await account.signMessage(msg, networks[0].chainId, 'eip6492')

          const valid = await account.reader(networks[0].chainId).isValidSignature(account.address, ethers.hashMessage(msg), sig)

          expect(valid).to.be.true
        })

        it('Should fail to sign a message signed by deployed migrated wallet (deployed with v1) if throw', async () => {
          const deployTx = Wallet.buildDeployTransaction(contexts[1], imageHash)
          await signer1
            .sendTransaction({
              to: deployTx.entrypoint,
              data: commons.transaction.encodeBundleExecData(deployTx)
            })
            .then(tx => tx.wait())

          expect(await networks[0].provider!.getCode(account.address).then(c => ethers.getBytes(c).length)).to.not.equal(0)

          const msg = ethers.toUtf8Bytes('Everything seems to be working fine so far')
          const sig = account.signMessage(msg, networks[0].chainId, 'throw')
          expect(sig).to.be.rejected
        })

        it('Should return an invalid signature by deployed migrated wallet (deployed with v1) if ignore', async () => {
          const deployTx = Wallet.buildDeployTransaction(contexts[1], imageHash)
          await signer1
            .sendTransaction({
              to: deployTx.entrypoint,
              data: commons.transaction.encodeBundleExecData(deployTx)
            })
            .then(tx => tx.wait())

          expect(await networks[0].provider!.getCode(account.address).then(c => ethers.getBytes(c).length)).to.not.equal(0)

          const msg = ethers.toUtf8Bytes('Everything seems to be working fine so far')
          const sig = await account.signMessage(msg, networks[0].chainId, 'ignore')
          const valid = await account.reader(networks[0].chainId).isValidSignature(account.address, ethers.hashMessage(msg), sig)

          expect(valid).to.be.false
        })
      })
    })
  })

  describe('Nonce selection', async () => {
    let signer: ethers.Wallet
    let account: Account

    let getNonce: (response: ethers.TransactionResponse) => { space: bigint; nonce: bigint }

    before(async () => {
      const mainModule = new ethers.Interface(walletContracts.mainModule.abi)

      getNonce = ({ data }) => {
        const [_, encoded] = mainModule.decodeFunctionData('execute', data)
        const [space, nonce] = commons.transaction.decodeNonce(encoded)
        return { space, nonce }
      }

      signer = randomWallet('Nonce selection')

      const config = {
        threshold: 1,
        checkpoint: Math.floor(now() / 1000),
        signers: [{ address: signer.address, weight: 1 }]
      }

      account = await Account.new({
        ...defaultArgs,
        config,
        orchestrator: new Orchestrator([signer])
      })

      // use a deployed account, otherwise we end up testing the decorated bundle nonce
      const response = await account.sendTransaction([], networks[0].chainId)
      await response?.wait()

      await getEth(account.address, signer1)
      await getEth(account.address, signer2)
    })

    it('Should use explicitly set nonces', async () => {
      let response = await account.sendTransaction(
        { to: await signer1.getAddress(), value: 1 },
        networks[0].chainId,
        undefined,
        undefined,
        undefined,
        { nonceSpace: 6492 }
      )
      if (!response) {
        throw new Error('expected response')
      }

      let { space, nonce } = getNonce(response)

      expect(space === 6492n).to.be.true
      expect(nonce === 0n).to.be.true

      await response.wait()

      response = await account.sendTransaction(
        { to: await signer1.getAddress(), value: 1 },
        networks[0].chainId,
        undefined,
        undefined,
        undefined,
        { nonceSpace: 6492 }
      )
      if (!response) {
        throw new Error('expected response')
      }

      const encoded = getNonce(response)
      space = encoded.space
      nonce = encoded.nonce

      expect(space === 6492n).to.be.true
      expect(nonce === 1n).to.be.true
    })

    it('Should select random nonces by default', async () => {
      let response = await account.sendTransaction({ to: await signer1.getAddress(), value: 1 }, networks[0].chainId)
      if (!response) {
        throw new Error('expected response')
      }

      const { space: firstSpace, nonce: firstNonce } = getNonce(response)

      expect(firstSpace === 0n).to.be.false
      expect(firstNonce === 0n).to.be.true

      // not necessary, parallel execution is ok:
      // await response.wait()

      response = await account.sendTransaction({ to: await signer1.getAddress(), value: 1 }, networks[0].chainId)
      if (!response) {
        throw new Error('expected response')
      }

      const { space: secondSpace, nonce: secondNonce } = getNonce(response)

      expect(secondSpace === 0n).to.be.false
      expect(secondNonce === 0n).to.be.true

      expect(secondSpace === firstSpace).to.be.false
    })

    it('Should respect the serial option', async () => {
      let response = await account.sendTransaction(
        { to: await signer1.getAddress(), value: 1 },
        networks[0].chainId,
        undefined,
        undefined,
        undefined,
        { serial: true }
      )
      if (!response) {
        throw new Error('expected response')
      }

      let { space, nonce } = getNonce(response)

      expect(space === 0n).to.be.true
      expect(nonce === 0n).to.be.true

      await response.wait()

      response = await account.sendTransaction(
        { to: await signer1.getAddress(), value: 1 },
        networks[0].chainId,
        undefined,
        undefined,
        undefined,
        { serial: true }
      )
      if (!response) {
        throw new Error('expected response')
      }

      const encoded = getNonce(response)
      space = encoded.space
      nonce = encoded.nonce

      expect(space === 0n).to.be.true
      expect(nonce === 1n).to.be.true
    })
  })
})

let nowCalls = 0
export function now(): number {
  if (deterministic) {
    return Date.parse('2023-02-14T00:00:00.000Z') + 1000 * nowCalls++
  } else {
    return Date.now()
  }
}

export function randomWallet(entropy: number | string): ethers.Wallet {
  return new ethers.Wallet(ethers.hexlify(randomBytes(32, entropy)))
}

export function randomFraction(entropy: number | string): number {
  const bytes = randomBytes(7, entropy)
  bytes[0] &= 0x1f
  return bytes.reduce((sum, byte) => 256 * sum + byte) / Number.MAX_SAFE_INTEGER
}

export function randomBytes(length: number, entropy: number | string): Uint8Array {
  if (deterministic) {
    let bytes = ''
    while (bytes.length < 2 * length) {
      bytes += ethers.id(`${bytes}${entropy}`).slice(2)
    }
    return ethers.getBytes(`0x${bytes.slice(0, 2 * length)}`)
  } else {
    return ethers.randomBytes(length)
  }
}
