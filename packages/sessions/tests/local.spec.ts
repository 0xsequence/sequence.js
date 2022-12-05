
import * as chai from 'chai'
import * as utils from '@0xsequence/tests'

import { trackers, tracker } from '../src/index'
import { universal } from '@0xsequence/core'

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
}]

describe('Local config tracker', () => {
  ([{
    name: 'Using memory store',
    store: () => new trackers.local.MemoryStore()
  }]).map(({ name, store }) => {
    describe(name, () => {
      let tracker: tracker.ConfigTracker

      beforeEach(() => {
        tracker = new trackers.local.LocalConfigTracker(store())
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
      })
    })
  })
})