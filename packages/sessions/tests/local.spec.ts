
import hardhat from 'hardhat'
import * as chai from 'chai'
import * as utils from '@0xsequence/tests'

import { trackers, tracker } from '../src/index'
import { commons, universal, v2 } from '@0xsequence/core'
import { ethers } from 'ethers'
import { Wallet } from '@0xsequence/wallet'
import { Orchestrator } from '@0xsequence/signhub'

const { expect } = chai

const ConfigCases = [{
  name: 'v1, random',
  config: () => utils.configs.random.genRandomV1Config()
}, {
  name: 'v1, no signers',
  config: () => utils.configs.random.genRandomV1Config(undefined, 0)
}, {
  name: 'v1, 1 signer',
  config: () => utils.configs.random.genRandomV1Config(undefined, 1)
}, {
  name: 'v1, 2 signers',
  config: () => utils.configs.random.genRandomV1Config(undefined, 2)
}, {
  name: 'v1, 3 signers',
  config: () => utils.configs.random.genRandomV1Config(undefined, 3)
}, {
  name: 'v1, 4 signers',
  config: () => utils.configs.random.genRandomV1Config(undefined, 4)
}, {
  name: 'v1, 100 signers',
  config: () => utils.configs.random.genRandomV1Config(undefined, 100)
}, {
  name: 'v1, 101 signers',
  config: () => utils.configs.random.genRandomV1Config(undefined, 101)
}, {
  name: 'v2 (random)',
  config: () => utils.configs.random.genRandomV2Config()
}, {
  name: 'v2, 1 signer',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 1, 0)
}, {
  name: 'v2, 2 signers',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 2, 0)
}, {
  name: 'v2, 3 signers',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 3, 0)
}, {
  name: 'v2, 4 signers',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 4, 0)
}, {
  name: 'v2, 5 signers',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 5, 0)
}, {
  name: 'v2, 59 signers',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 59, 0)
}, {
  name: 'v2, 5 signers (merkle)',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 5, 0, true)
}, {
  name: 'v2, 11 signers (merkle)',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 11, 0, true)
}, {
  name: 'v2, 101 signers (merkle)',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 101, 0, true)
}, {
  name: 'v2, 1 subdigest',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 0, 1)
}, {
  name: 'v2, 10 subdigest (merkle)',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 0, 10, true)
}, {
  name: 'v2, 12 signers, 55 subdigest (merkle)',
  config: () => utils.configs.random.genRandomV2Config(undefined, undefined, 12, 55, true)
}, {
  name: 'v2, random nested configs',
  config: () => {
    const nested1 = utils.configs.random.genRandomV2Config(undefined, undefined, 11, 10, true)
    const nested2 = utils.configs.random.genRandomV2Config()

    return {
      version: 2,
      threshold: ethers.BigNumber.from(2),
      checkpoint: ethers.BigNumber.from(392919),
      tree: {
        left: {
          subdigest: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
        },
        right: {
          left: {
            weight: ethers.BigNumber.from(1),
            threshold: ethers.BigNumber.from(99),
            tree: nested1.tree
          },
          right: {
            weight: ethers.BigNumber.from(99),
            threshold: ethers.BigNumber.from(1),
            tree: nested2.tree
          }
        }
      }
    } as v2.config.WalletConfig
  }
}]

const randomContext = () => {
  return {
    version: Math.floor(Math.random() * 10) + 1,
    factory: ethers.Wallet.createRandom().address,
    mainModule: ethers.Wallet.createRandom().address,
    mainModuleUpgradable: ethers.Wallet.createRandom().address,
    guestModule: ethers.Wallet.createRandom().address,

    walletCreationCode: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
  }
}

describe('Local config tracker', () => {
  let provider: ethers.providers.Web3Provider

  before(async () => {
    provider = new ethers.providers.Web3Provider(hardhat.network.provider.send)
  });

  ([{
    name: 'Using memory store',
    store: () => new trackers.local.MemoryStore()
  }]).map(({ name, store }) => {
    describe(name, () => {
      let tracker: tracker.ConfigTracker

      beforeEach(() => {
        tracker = new trackers.local.LocalConfigTracker(store(), provider)
      })

      describe('Configuration', () => {
        ConfigCases.map((o) => {
          it(`Should be able to set and get ${o.name}`, async () => {
            const config = o.config()

            await tracker.saveWalletConfig({ config })

            const imageHash = universal.genericCoderFor(config.version).config.imageHashOf(config)
            const getConfig = await tracker.configOfImageHash({ imageHash })

            expect(getConfig).to.deep.equal(config)
          })
        })

        it('Should handle all cases at once', async () => {
          const shuffled = ConfigCases.sort(() => Math.random() - 0.5)
          const configs = shuffled.map((o) => o.config())

          for (const config of configs) {
            await tracker.saveWalletConfig({ config })

            const imageHash = universal.genericCoderFor(config.version).config.imageHashOf(config)
            const getConfig = await tracker.configOfImageHash({ imageHash })

            expect(getConfig).to.deep.equal(config)
          }

          for (const config of configs) {
            const imageHash = universal.genericCoderFor(config.version).config.imageHashOf(config)
            const getConfig = await tracker.configOfImageHash({ imageHash })

            expect(getConfig).to.deep.equal(config)
          }

          // Adding the configs again should not change anything
          for (const config of configs) {
            await tracker.saveWalletConfig({ config })

            const imageHash = universal.genericCoderFor(config.version).config.imageHashOf(config)
            const getConfig = await tracker.configOfImageHash({ imageHash })

            expect(getConfig).to.deep.equal(config)
          }
        })

        it('Should combine two different v2 configurations', async () => {
          const config1 = utils.configs.random.genRandomV2Config(undefined, undefined, 25, 15, true)
          const config2 = utils.configs.random.genRandomV2Config(undefined, undefined, 2, 1, false)

          const ih1 = v2.config.imageHash(config1)
          const ih2 = v2.config.imageHash(config2)

          const emptyConfig = {
            version: 2,
            threshold: ethers.BigNumber.from(2),
            checkpoint: ethers.BigNumber.from(0),
            tree: {
              left: { nodeHash: v2.config.hashNode(config1.tree) },
              right: { nodeHash: v2.config.hashNode(config2.tree) }
            }
          }

          const imageHash = v2.config.imageHash(emptyConfig)

          await tracker.saveWalletConfig({ config: emptyConfig })
          expect(await tracker.configOfImageHash({ imageHash })).to.deep.equal(emptyConfig)

          // Add the first config
          // should reveal the left branch
          await tracker.saveWalletConfig({ config: config1 })
          expect(await tracker.configOfImageHash({ imageHash: ih1 })).to.deep.equal(config1)
          expect(await tracker.configOfImageHash({ imageHash })).to.deep.equal({
            version: 2,
            threshold: ethers.BigNumber.from(2),
            checkpoint: ethers.BigNumber.from(0),
            tree: {
              left: config1.tree,
              right: { nodeHash: v2.config.hashNode(config2.tree) }
            }
          })

          // Add the second config
          // should reveal the whole tree
          await tracker.saveWalletConfig({ config: config2 })
          expect(await tracker.configOfImageHash({ imageHash: ih2 })).to.deep.equal(config2)
          expect(await tracker.configOfImageHash({ imageHash })).to.deep.equal({
            version: 2,
            threshold: ethers.BigNumber.from(2),
            checkpoint: ethers.BigNumber.from(0),
            tree: {
              left: config1.tree,
              right: config2.tree
            }
          })
        })

        it('Should return undefined for unknown imageHash', async () => {
          const imageHash = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          expect(await tracker.configOfImageHash({ imageHash })).to.be.undefined
        })
      })

      describe('Counter factual address', () => {
        it('Should set and get address', async () => {
          const context = randomContext()
          const imageHash = ethers.utils.hexlify(ethers.utils.randomBytes(32))

          const wallet = commons.context.addressOf(context, imageHash)
          await tracker.saveCounterFactualWallet({ context: [context], imageHash })
          const res = await tracker.imageHashOfCounterFactualWallet({ wallet })

          expect(res).to.deep.equal({ imageHash, context })
        })

        it('Should set address for multiple configs', async () => {
          const contexts = new Array(5).fill(0).map(() => randomContext())
          const imageHash = ethers.utils.hexlify(ethers.utils.randomBytes(32))

          const wallets = contexts.map((c) => commons.context.addressOf(c, imageHash))
          await tracker.saveCounterFactualWallet({ context: contexts, imageHash })

          for (let i = 0; i < wallets.length; i++) {
            const res = await tracker.imageHashOfCounterFactualWallet({ wallet: wallets[i] })
            expect(res).to.deep.equal({ imageHash, context: contexts[i] })
          }
        })

        it('Should return undefined for unknown wallet', async () => {
          const wallet = ethers.Wallet.createRandom().address
          expect(await tracker.imageHashOfCounterFactualWallet({ wallet })).to.be.undefined
        })
      })

      describe('Chained configurations', () => {
        let context: commons.context.WalletContext

        before(async () => {
          context = await utils.context.deploySequenceContexts(provider.getSigner(0)).then((c) => c[2])
        })

        it('Should return return empty chained configuration if config is now known', async () => {
          const imageHash = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          const res = await tracker.loadPresignedConfiguration({ wallet: ethers.Wallet.createRandom().address, fromImageHash: imageHash, checkpoint: 0 })
          expect(res).to.deep.equal([])
        })

        it('Should return no chained configuration if no presigned transactions', async () => {
          const config = utils.configs.random.genRandomV2Config()
          const imageHash = v2.config.imageHash(config)
          await tracker.saveWalletConfig({ config })
          const res = await tracker.loadPresignedConfiguration({ wallet: ethers.Wallet.createRandom().address, fromImageHash: imageHash, checkpoint: 0 })
          expect(res).to.deep.equal([])
        })

        it.only('Should return single presigned step', async () => {
          const signer = ethers.Wallet.createRandom()
          console.log('signer', signer.address)
          const config = { version: 2, threshold: 1, checkpoint: 0, tree: { address: signer.address, weight: 1 } }
          const imageHash = v2.config.imageHash(config)
          const address = commons.context.addressOf(context, imageHash)
          const wallet = new Wallet({ config, chainId: 0, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer]) })

          const nextConfig = utils.configs.random.genRandomV2Config()
          const nextImageHash = v2.config.imageHash(nextConfig)

          const digest = v2.chained.hashSetImageHash(nextImageHash)
          const signature = await wallet.signMessage(ethers.utils.arrayify(digest))

          await tracker.saveWalletConfig({ config })
          await tracker.savePresignedConfiguration({ wallet: address, nextImageHash, signature, config })

          const res = await tracker.loadPresignedConfiguration({ wallet: address, fromImageHash: imageHash, checkpoint: 0 })
          expect(res.length).to.equal(1)
        })
      })
    })
  })
})
