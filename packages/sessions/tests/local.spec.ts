
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
        tracker = new trackers.local.LocalConfigTracker(provider, store())
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

        it('Should return return empty chained configuration if config is not known', async () => {
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

        it('Should return single presigned step', async () => {
          const signer = ethers.Wallet.createRandom()
          const config = { version: 2, threshold: 1, checkpoint: 0, tree: { address: signer.address, weight: 1 } }
          const imageHash = v2.config.imageHash(config)
          const address = commons.context.addressOf(context, imageHash)
          const wallet = new Wallet({ config, chainId: 0, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer]) })

          const nextConfig = utils.configs.random.genRandomV2Config()
          const nextImageHash = v2.config.imageHash(nextConfig)

          const digest = v2.chained.hashSetImageHash(nextImageHash)
          const signature = await wallet.signDigest(digest)

          await tracker.saveWalletConfig({ config })
          await tracker.saveWalletConfig({ config: nextConfig })
          await tracker.savePresignedConfiguration({ wallet: address, nextImageHash, signature })

          const res = await tracker.loadPresignedConfiguration({ wallet: address, fromImageHash: imageHash, checkpoint: 0 })
          expect(res.length).to.equal(1)
          expect(res[0].nextImageHash).to.equal(nextImageHash)
          expect(res[0].wallet).to.equal(wallet.address)
          expect(res[0].signature).to.equal(signature)
        })

        it('Should return empty for wrong wallet', async () => {
          const signer = ethers.Wallet.createRandom()
          const config = { version: 2, threshold: 1, checkpoint: 0, tree: { address: signer.address, weight: 1 } }
          const imageHash = v2.config.imageHash(config)
          const address = commons.context.addressOf(context, imageHash)
          const wallet = new Wallet({ config, chainId: 0, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer]) })

          const nextConfig = utils.configs.random.genRandomV2Config()
          const nextImageHash = v2.config.imageHash(nextConfig)

          const digest = v2.chained.hashSetImageHash(nextImageHash)
          const signature = await wallet.signDigest(digest)

          await tracker.saveWalletConfig({ config })
          await tracker.saveWalletConfig({ config: nextConfig })
          await tracker.savePresignedConfiguration({ wallet: address, nextImageHash, signature })

          const wrongWallet = ethers.Wallet.createRandom().address
          const res = await tracker.loadPresignedConfiguration({ wallet: wrongWallet, fromImageHash: imageHash, checkpoint: 0 })
          expect(res.length).to.equal(0)
        })

        it('Should return two steps', async () => {
          // Step 1
          const signer = ethers.Wallet.createRandom()
          const config = { version: 2, threshold: 1, checkpoint: 0, tree: { address: signer.address, weight: 1 } }
          const imageHash = v2.config.imageHash(config)

          const address = commons.context.addressOf(context, imageHash)
          const wallet1 = new Wallet({ config, chainId: 0, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer]) })

          const signer2a = ethers.Wallet.createRandom()
          const signer2b = ethers.Wallet.createRandom()
          const nextConfig1 = { version: 2, threshold: 6, checkpoint: 2, tree: {
              right: {
                address: signer2a.address, weight: 3
              },
              left: {
                address: signer2b.address, weight: 3
              }
            }
          }

          const nextImageHash1 = v2.config.imageHash(nextConfig1)

          const digest1 = v2.chained.hashSetImageHash(nextImageHash1)
          const signature1 = await wallet1.signDigest(digest1)

          // Step 2
          const nextConfig2 = { ...utils.configs.random.genRandomV2Config(), checkpoint: 3 }
          const nextImageHash2 = v2.config.imageHash(nextConfig2)

          const digest2 = v2.chained.hashSetImageHash(nextImageHash2)
          const wallet2 = new Wallet({
            config: nextConfig1,
            chainId: 0,
            coders: v2.coders,
            address,
            context,
            orchestrator: new Orchestrator([signer2a, signer2b])
          })

          const signature2 = await wallet2.signDigest(digest2)

          // Saving only signature2 should lead to empty path
          // becuase there is no route from initial config to config1
          await tracker.saveWalletConfig({ config })
          await tracker.saveWalletConfig({ config: nextConfig1 })
          await tracker.saveWalletConfig({ config: nextConfig2 })
          await tracker.savePresignedConfiguration({
            wallet: address,
            nextImageHash: nextImageHash2,
            signature: signature2
          })

          const route0_2a = await tracker.loadPresignedConfiguration({
            wallet: address,
            fromImageHash: imageHash,
            checkpoint: 0
          })

          expect(route0_2a.length).to.equal(0)

          // But starting from imageHash1 should give us a link
          const result1_2a = await tracker.loadPresignedConfiguration({
            wallet: address,
            fromImageHash:  nextImageHash1,
            checkpoint: 0
          })

          expect(result1_2a.length).to.equal(1)
          expect(result1_2a[0].nextImageHash).to.equal(nextImageHash2)
          expect(result1_2a[0].signature).to.equal(signature2)
          expect(result1_2a[0].wallet).to.equal(address)

          // Unless the checkpoint is equal to config2
          const result1_2b = await tracker.loadPresignedConfiguration({
            wallet: address,
            fromImageHash:  nextImageHash1,
            checkpoint: 3
          })

          expect(result1_2b.length).to.equal(0)

          // Adding the 0_1 step should give us a full chain to 2
          await tracker.savePresignedConfiguration({
            wallet: address,
            nextImageHash: nextImageHash1,
            signature: signature1
          })

          const result0_2b = await tracker.loadPresignedConfiguration({
            wallet: address,
            fromImageHash: imageHash,
            checkpoint: 0
          })

          expect(result0_2b.length).to.equal(2)
          expect(result0_2b[0].wallet).to.equal(address)
          expect(result0_2b[1].wallet).to.equal(address)
          expect(result0_2b[0].nextImageHash).to.equal(nextImageHash1)
          expect(result0_2b[1].nextImageHash).to.equal(nextImageHash2)
          expect(result0_2b[0].signature).to.equal(signature1)
          expect(result0_2b[1].signature).to.equal(signature2)
        })

        it('Should skip step if it uses the same signers', async () => {
          const signer1 = ethers.Wallet.createRandom()
          const config1 = { version: 2, threshold: 1, checkpoint: 0, tree: { address: signer1.address, weight: 1 } }
          const imageHash1 = v2.config.imageHash(config1)
          const address = commons.context.addressOf(context, imageHash1)
          const wallet = new Wallet({ config: config1, chainId: 0, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer1]) })

          const signer2 = ethers.Wallet.createRandom()
          const config2 = {
            version: 2,
            threshold: 3,
            checkpoint: 1,
            tree: {
              left: {
                address: signer1.address,
                weight: 3
              },
              right: {
                address: signer2.address,
                weight: 4
              }
            }
          }

          const imageHash2 = v2.config.imageHash(config2)

          const digest1 = v2.chained.hashSetImageHash(imageHash2)
          const signature1 = await wallet.signDigest(digest1)

          const config3 = utils.configs.random.genRandomV2Config()
          const imageHash3 = v2.config.imageHash(config3)

          const digest2 = v2.chained.hashSetImageHash(imageHash3)
          const wallet2 = new Wallet({
            config: config2,
            chainId: 0,
            coders: v2.coders,
            address,
            context,
            orchestrator: new Orchestrator([signer1, signer2])
          })

          const signature2 = await wallet2.signDigest(digest2)

          await tracker.saveWalletConfig({ config: config1 })
          await tracker.saveWalletConfig({ config: config2 })
          await tracker.saveWalletConfig({ config: config3 })
          await tracker.savePresignedConfiguration({ wallet: address, nextImageHash: imageHash2, signature: signature1 })
          await tracker.savePresignedConfiguration({ wallet: address, nextImageHash: imageHash3, signature: signature2 })

          // Going from 1 to 3 should give us 1 jump
          const resa = await tracker.loadPresignedConfiguration({
            wallet: address,
            fromImageHash: imageHash1,
            checkpoint: 0
          })

          expect(resa.length).to.equal(1)
          expect(resa[0].wallet).to.equal(address)
          expect(resa[0].nextImageHash).to.equal(imageHash3)
          // This is equivalent to having signed the update
          // with only signer1 (because that's what we have in imageHash1)
          expect(resa[0].signature).to.equal(await wallet.signDigest(digest2))

          // Unless we ask for the longest path, then we should find
          // both jumps
          const resb = await tracker.loadPresignedConfiguration({
            wallet: address,
            fromImageHash: imageHash1,
            checkpoint: 0,
            longestPath: true
          })

          expect(resb.length).to.equal(2)
          expect(resb[0].wallet).to.equal(address)
          expect(resb[1].wallet).to.equal(address)
          expect(resb[0].nextImageHash).to.equal(imageHash2)
          expect(resb[1].nextImageHash).to.equal(imageHash3)
          expect(resb[0].signature).to.equal(signature1)
          expect(resb[1].signature).to.equal(signature2)

          // Should return wallets of signer1 and signer2
          const wallets1 = await tracker.walletsOfSigner({ signer: signer1.address })
          expect(wallets1.length).to.equal(1)
          expect(wallets1[0].wallet).to.equal(address)

          const wallets2 = await tracker.walletsOfSigner({ signer: signer2.address })
          expect(wallets2.length).to.equal(1)
          expect(wallets2[0].wallet).to.equal(address)
        })
      })

      describe('Handle witnesses', async () => {
        let context: commons.context.WalletContext

        before(async () => {
          context = await utils.context.deploySequenceContexts(provider.getSigner(0)).then((c) => c[2])
        })

        it('Should retrieve no witness for never used signer', async () => {
          const signer = ethers.Wallet.createRandom().address
          const witness = await tracker.walletsOfSigner({ signer })
          expect(witness.length).to.equal(0)
        })

        it('Should save a witness for a signer', async () => {
          const signer = ethers.Wallet.createRandom()
          const config = { version: 2, threshold: 1, checkpoint: 0, tree: { address: signer.address, weight: 1 } }
          const imageHash = v2.config.imageHash(config)
          const address = commons.context.addressOf(context, imageHash)
          const wallet = new Wallet({ config, chainId: 1, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer]) })

          const digest = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          const signature = await wallet.signDigest(digest)

          const decoded = v2.signature.SignatureCoder.decode(signature)
          await tracker.saveWitness({
            wallet: address,
            digest,
            chainId: 1,
            signature: (decoded.decoded.tree as v2.signature.SignatureLeaf).signature
          })

          const witness = await tracker.walletsOfSigner({ signer: signer.address })
          expect(witness.length).to.equal(1)
          expect(witness[0].wallet).to.equal(address)
          expect(witness[0].proof.chainId.toNumber()).to.equal(1)
          expect(witness[0].proof.digest).to.equal(digest)
          expect(witness[0].proof.signature).to.equal((decoded.decoded.tree as v2.signature.SignatureLeaf).signature)

          // Adding a second witness should not change anything
          const digest2 = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          const signature2 = await wallet.signDigest(digest2)
          const decoded2 = v2.signature.SignatureCoder.decode(signature2)
          await tracker.saveWitness({
            wallet: address,
            digest: digest2,
            chainId: 1,
            signature: (decoded2.decoded.tree as v2.signature.SignatureLeaf).signature
          })

          const witness2 = await tracker.walletsOfSigner({ signer: signer.address })
          expect(witness2.length).to.equal(1)

          // Adding a witness for a different chain should not change anything
          const digest3 = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          const wallet2 = new Wallet({ config, chainId: 2, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer]) })
          const signature3 = await wallet2.signDigest(digest3)
          const decoded3 = v2.signature.SignatureCoder.decode(signature3)
          await tracker.saveWitness({
            wallet: address,
            digest: digest3,
            chainId: 2,
            signature: (decoded3.decoded.tree as v2.signature.SignatureLeaf).signature
          })

          const witness3 = await tracker.walletsOfSigner({ signer: signer.address })
          expect(witness3.length).to.equal(1)
        })

        it('It should save witnesses for multiple wallets', async () => {
          const signer = ethers.Wallet.createRandom()
          const config = { version: 2, threshold: 1, checkpoint: 0, tree: { address: signer.address, weight: 1 } }
          const imageHash = v2.config.imageHash(config)
          const address = commons.context.addressOf(context, imageHash)
          const wallet = new Wallet({ config, chainId: 1, coders: v2.coders, address, context, orchestrator: new Orchestrator([signer]) })

          const digest = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          const signature = await wallet.signDigest(digest)

          const decoded = v2.signature.SignatureCoder.decode(signature)
          await tracker.saveWitness({
            wallet: address,
            digest,
            chainId: 1,
            signature: (decoded.decoded.tree as v2.signature.SignatureLeaf).signature
          })

          const config2 = { version: 2, threshold: 2, checkpoint: 0, tree: { address: signer.address, weight: 2 } }
          const imageHash2 = v2.config.imageHash(config2)
          const address2 = commons.context.addressOf(context, imageHash2)
          const wallet2 = new Wallet({ config: config2, chainId: 1, coders: v2.coders, address: address2, context, orchestrator: new Orchestrator([signer]) })

          const digest2 = ethers.utils.hexlify(ethers.utils.randomBytes(32))
          const signature2 = await wallet2.signDigest(digest2)

          const decoded2 = v2.signature.SignatureCoder.decode(signature2)
          await tracker.saveWitness({
            wallet: address2,
            digest: digest2,
            chainId: 1,
            signature: (decoded2.decoded.tree as v2.signature.SignatureLeaf).signature
          })

          const witness = await tracker.walletsOfSigner({ signer: signer.address })
          expect(witness.length).to.equal(2)

          const wallet1Result = witness.find((w) => w.wallet === address)
          const wallet2Result = witness.find((w) => w.wallet === address2)
          expect(wallet1Result).to.not.be.undefined
          expect(wallet2Result).to.not.be.undefined

          expect(wallet1Result?.proof.chainId.toNumber()).to.equal(1)
          expect(wallet1Result?.proof.digest).to.equal(digest)
          expect(wallet1Result?.proof.signature).to.equal((decoded.decoded.tree as v2.signature.SignatureLeaf).signature)

          expect(wallet2Result?.proof.chainId.toNumber()).to.equal(1)
          expect(wallet2Result?.proof.digest).to.equal(digest2)
          expect(wallet2Result?.proof.signature).to.equal((decoded2.decoded.tree as v2.signature.SignatureLeaf).signature)
        })
      })
    })
  })
})
