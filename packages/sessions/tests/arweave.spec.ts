import { commons, universal } from '@0xsequence/core'
import { expect } from 'chai'
import { ethers } from 'ethers'

import { trackers } from '../src'

describe('Arweave config reader', () => {
  const namespace = 'axovybcmguutleij'

  it('Should find the config for an image hash', async () => {
    const imageHash = '0x8f482f815eaa9520202b76568b8603defad3460f9f345b2bf87a28df5b5cb3db'

    const reader = new trackers.arweave.ArweaveReader(namespace)
    const config = await reader.configOfImageHash({ imageHash })
    if (!config) {
      throw new Error('config not found')
    }

    const coder = universal.genericCoderFor(config.version)
    expect(coder.config.imageHashOf(config)).to.equal(imageHash)
  })

  it('Should find the deploy config for a wallet', async () => {
    const address = '0xF67736062872Dbc10FD2882B15C868b6c9645A9D'

    const reader = new trackers.arweave.ArweaveReader(namespace)
    const wallet = await reader.imageHashOfCounterfactualWallet({ wallet: address })
    if (!wallet) {
      throw new Error('wallet not found')
    }

    expect(commons.context.addressOf(wallet.context, wallet.imageHash)).to.equal(address)
  })

  it('Should find the wallets for a signer', async () => {
    const signer = '0x764d3a80ae2C1Dc0a38d14787f382168EF0Cd270'

    const reader = new trackers.arweave.ArweaveReader(namespace)
    const wallets = await reader.walletsOfSigner({ signer })

    expect(wallets.some(({ wallet }) => wallet === '0x647E7eb8E2834f8818E964B97336e41E20639267')).to.be.true

    expect(
      wallets.every(
        ({ wallet, proof: { digest, chainId, signature } }) =>
          commons.signer.recoverSigner(commons.signature.subdigestOf({ digest, chainId, address: wallet }), signature) === signer
      )
    ).to.be.true
  })

  it('Should find the shortest sequence of config updates from a config', async () => {
    const wallet = '0x05971669C685c1ECbc4D441D1b81Ecc49A249EEe'
    const fromImageHash = '0x004c53ffce56402f25764c11c5538f83b73064cc2bd15b14701062f92fd3d648'

    const reader = new trackers.arweave.ArweaveReader(namespace)
    const updates = await reader.loadPresignedConfiguration({ wallet, fromImageHash })

    expect(updates).to.deep.equal([
      {
        wallet: '0x05971669C685c1ECbc4D441D1b81Ecc49A249EEe',
        nextImageHash: '0x0120af3a0e2941d5a36b7f2e243610f6351a8e290da1bec3cbc3b6b779222884',
        signature:
          '0x020005000000000003d5201fd0e49c26d0cade41946fb556027b2dff5bcfabaccade08966202848e7e2a176606a431262902c871978e2f04366f02da9b82d91b8c4fcaaa6e14ddfeee1b02040000160102597772c0a183204efaec323b37a9ed6d88c988040400007b02031d76d1d72ec65a9b933745bd0a87caa0fac75af0000062020001000000000001b55725759bf1af93aab1669a44e2c0f1bf1c04103c1a3c2b81fc29fe54bcc49f1342954985f438410c8c8aa3d049675886bbd8b52e256e1cb9d7c10a616f8d901c02010190d62a32d1cc65aa3e80b567c8c0d3ca0f411e6103'
      }
    ])
  })

  it('Should find the longest sequence of config updates from a config', async () => {
    const wallet = '0x05971669C685c1ECbc4D441D1b81Ecc49A249EEe'
    const fromImageHash = '0x004c53ffce56402f25764c11c5538f83b73064cc2bd15b14701062f92fd3d648'

    const reader = new trackers.arweave.ArweaveReader(namespace)
    const updates = await reader.loadPresignedConfiguration({ wallet, fromImageHash, longestPath: true })

    expect(updates).to.deep.equal([
      {
        wallet: '0x05971669C685c1ECbc4D441D1b81Ecc49A249EEe',
        nextImageHash: '0x8aebdaf8de8d8c6db6879841e7b85f6480841282af739a9f39b1f0c69b42d6a2',
        signature:
          '0x0200050000000000038ee84d1cf3a3bd92165f0b85f83e407a7e69a3ee76d82f214e189b5aa5cf2a05277bd8e0723d4b027125058cfa2c6e7eba6c68051ee95368cf80245e1d7ebbb81b02040000160102597772c0a183204efaec323b37a9ed6d88c988040400007b02031d76d1d72ec65a9b933745bd0a87caa0fac75af0000062020001000000000001ac512777ebd109baf295b2f20d4ba11ef847644dda15a6b19eefd857b195a0294401a3a0080f529fda753191660ab61588356c9bf15b8cd54117fc0cf0f6c8fe1c02010190d62a32d1cc65aa3e80b567c8c0d3ca0f411e6103'
      },
      {
        wallet: '0x05971669C685c1ECbc4D441D1b81Ecc49A249EEe',
        nextImageHash: '0x37758fed5c4c60994461125152139963b5025521cbd7c708de3d95df396605e0',
        signature:
          '0x0200050000000103c4b8aa34ceeec966dd15d51d5004c2695e21efc746dcb48531e8670ed01b858e0400007b02031d76d1d72ec65a9b933745bd0a87caa0fac75af0000062020001000000000001ee79a0d368eb32bc73446fabbf65e265beadc06d41720bb5144852e6182dff92154ebec93a0b0f28344dcf4fc533b979d2612e73c8cf04f0aac653e3014394c91b02010190d62a32d1cc65aa3e80b567c8c0d3ca0f411e6103040000440002c8989589a1489d456908c6c2f0317ce0bacf8fc2d64a696461642cfdb6d439f725d19274ce07f96f401232413fa0f9ce6d98497d20935138c2b710fa7ae9f5e01b02'
      },
      {
        wallet: '0x05971669C685c1ECbc4D441D1b81Ecc49A249EEe',
        nextImageHash: '0x0120af3a0e2941d5a36b7f2e243610f6351a8e290da1bec3cbc3b6b779222884',
        signature:
          '0x020005000000020003d5201fd0e49c26d0cade41946fb556027b2dff5bcfabaccade08966202848e7e2a176606a431262902c871978e2f04366f02da9b82d91b8c4fcaaa6e14ddfeee1b02040000160102c623539534a553bb81a8e85698e5103bb55f2dac0400007b02031d76d1d72ec65a9b933745bd0a87caa0fac75af0000062020001000000000001b55725759bf1af93aab1669a44e2c0f1bf1c04103c1a3c2b81fc29fe54bcc49f1342954985f438410c8c8aa3d049675886bbd8b52e256e1cb9d7c10a616f8d901c02010190d62a32d1cc65aa3e80b567c8c0d3ca0f411e6103'
      }
    ])
  })

  it('Should find a migration', async () => {
    const address = '0x32284cD48A2cD2b3613Cbf8CD56693fe39B738Ee'
    const fromVersion = 1
    const fromImageHash = '0x2662c159baa712737224f8a3aef97e5585ba4f2550ad2354832066b88b44fddf'
    const toVersion = 2
    const toImageHash = '0xd2a9ad2da5358d21878a6e79d39feb4c1e67f984aa3db074021b51b6ffdad3d5'
    const chainId = 42161

    const reader = new trackers.arweave.ArweaveReader(namespace)
    const migration = await reader.getMigration(address, fromImageHash, fromVersion, chainId)
    if (!migration) {
      throw new Error('migration not found')
    }

    expect(migration.tx.intent.wallet).to.equal(address)
    expect(ethers.BigNumber.from(migration.tx.chainId).eq(chainId)).to.be.true
    expect(migration.fromVersion).to.equal(fromVersion)
    expect(migration.toVersion).to.equal(toVersion)
    expect(migration.toConfig.version).to.equal(toVersion)

    const toCoder = universal.genericCoderFor(migration.toVersion)
    expect(toCoder.config.imageHashOf(migration.toConfig)).to.equal(toImageHash)

    const provider: ethers.providers.Provider = null!
    const fromCoder = universal.genericCoderFor(migration.fromVersion)
    const decoded = fromCoder.signature.decode(migration.tx.signature)
    const digest = commons.transaction.digestOfTransactions(migration.tx.nonce, migration.tx.transactions)
    const recovered = await fromCoder.signature.recover(decoded, { digest, chainId, address }, provider)
    expect(fromCoder.config.imageHashOf(recovered.config)).to.equal(fromImageHash)
  })
})
