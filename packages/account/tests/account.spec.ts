
import hardhat from 'hardhat'
import * as chai from 'chai'
import * as utils from '@0xsequence/tests'

import { ethers } from 'ethers'
import { Orchestrator } from '@0xsequence/signhub'
import { Account } from '../src/account'
import { context, migrator } from '@0xsequence/migration'
import { NetworkConfig } from '@0xsequence/network'
import { tracker, trackers } from '@0xsequence/sessions'

const { expect } = chai

describe('Account', () => {
  let provider1: ethers.providers.JsonRpcProvider
  let provider2: ethers.providers.JsonRpcProvider

  let contexts: context.VersionedContext
  let networks: NetworkConfig[]

  let tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker

  let defaultArgs: {
    contexts: context.VersionedContext
    networks: NetworkConfig[]
    tracker: tracker.ConfigTracker & migrator.PresignedMigrationTracker
  }

  before(async () => {
    provider1 = new ethers.providers.Web3Provider(hardhat.network.provider.send)
    provider2 = new ethers.providers.JsonRpcProvider('http://localhost:7147')

    // TODO: Implement migrations on local config tracker
    tracker = new trackers.local.LocalConfigTracker(provider1) as any

    networks = [{
      chainId: 31337,
      name: 'hardhat',
      provider: provider1,
    }, {
      chainId: 31338,
      name: 'hardhat2',
      provider: provider2,
    }]

    const signer1 = provider1.getSigner()
    const signer2 = provider2.getSigner()

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
    })
  })
})
