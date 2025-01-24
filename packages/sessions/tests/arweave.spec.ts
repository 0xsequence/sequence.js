import { commons, universal, v2 } from '@0xsequence/core'
import { expect } from 'chai'
import { ethers } from 'ethers'

import { trackers } from '../src'

class MockProvider extends ethers.AbstractProvider {
  _detectNetwork(): Promise<ethers.Network> {
    return Promise.resolve(new ethers.Network('', 0))
  }

  _perform<T = any>(_req: ethers.PerformActionRequest): Promise<T> {
    return Promise.resolve('0x1626ba7e00000000000000000000000000000000000000000000000000000000' as any)
  }
}

describe('Arweave config reader', () => {
  const options = { namespace: 'xOovxYFkIwBpEwSi', owners: ['lJYCA4xBPJeZSgr9AF_4pHp4HVGvTOa4NYKJRoMBP5c'] }
  const arweave = new trackers.arweave.ArweaveReader(options)
  const sessions = new trackers.remote.RemoteConfigTracker('http://localhost:5555')
  const provider = new MockProvider()

  it('Should find the config for an image hash', async () => {
    const imageHash = '0x8073858470016c4fdee9d3ad7c929e81cb19668a73fde061f00645228676e8dd'

    const config = await arweave.configOfImageHash({ imageHash })
    if (!config) {
      throw new Error('config not found')
    }

    const coder = universal.genericCoderFor(config.version)
    expect(coder.config.imageHashOf(config)).to.equal(imageHash)
  })

  it('Should find the deploy hash for a wallet', async () => {
    const address = '0x801DC9A5F00f781cA0f1ca56dbA68DA69fB07cdC'

    const wallet = await arweave.imageHashOfCounterfactualWallet({ wallet: address })
    if (!wallet) {
      throw new Error('wallet not found')
    }

    expect(commons.context.addressOf(wallet.context, wallet.imageHash)).to.equal(address)
  })

  it('Should find the wallets for a signer', async () => {
    const signer = '0x8151D1B52dEb93eF2300884fC4CcddDDFf8C6BdA'

    const wallets = await arweave.walletsOfSigner({ signer })

    expect(wallets.some(({ wallet }) => wallet === '0x213400e26b4aA36885Bcb29A8B7D67caeB0348EC')).to.be.true

    expect(
      wallets.every(
        ({ wallet, proof: { digest, chainId, signature } }) =>
          commons.signer.recoverSigner(commons.signature.subdigestOf({ digest, chainId, address: wallet }), signature) === signer
      )
    ).to.be.true
  })

  it('Should find the shortest sequence of config updates from a config', async () => {
    const wallet = '0x36f8D1327F738608e275226A6De2D1720AF5C896'
    const fromImageHash = '0xacbf7d62011d908d4cdfc96651be39b77d56f8e8048e993a57470724eb6049be'

    const updates = await arweave.loadPresignedConfiguration({ wallet, fromImageHash })

    expect(updates.every(update => update.wallet === wallet)).to.be.true

    expect(updates.map(({ nextImageHash }) => nextImageHash)).to.deep.equal([
      '0x08b597e0fc694da132d38db2b9e6c598ea85d786aba1c9830def5df0fec6da67',
      '0xea570311d302ef75c4efe9da8041011a43b398682b5461bc3edfd5632fe36199'
    ])

    let imageHash = fromImageHash

    for (const { nextImageHash, signature } of updates) {
      const digest = v2.chained.hashSetImageHash(nextImageHash)
      const decoded = v2.signature.decodeSignature(signature)
      const recovered = await v2.signature.recoverSignature(decoded, { digest, chainId: 0, address: wallet }, provider)
      expect(v2.config.imageHash(recovered.config)).to.equal(imageHash)
      imageHash = nextImageHash
    }
  })

  it('Should find the longest sequence of config updates from a config', async () => {
    const wallet = '0x36f8D1327F738608e275226A6De2D1720AF5C896'
    const fromImageHash = '0xacbf7d62011d908d4cdfc96651be39b77d56f8e8048e993a57470724eb6049be'

    const updates = await arweave.loadPresignedConfiguration({ wallet, fromImageHash, longestPath: true })

    expect(updates.every(update => update.wallet === wallet)).to.be.true

    expect(updates.map(({ nextImageHash }) => nextImageHash)).to.deep.equal([
      '0x8230d5841133b06eeeba92494fcf28d4c7ca50ae59f092d630dbee0d07c5e4f5',
      '0x08b597e0fc694da132d38db2b9e6c598ea85d786aba1c9830def5df0fec6da67',
      '0xea570311d302ef75c4efe9da8041011a43b398682b5461bc3edfd5632fe36199'
    ])

    let imageHash = fromImageHash

    for (const { nextImageHash, signature } of updates) {
      const digest = v2.chained.hashSetImageHash(nextImageHash)
      const decoded = v2.signature.decodeSignature(signature)
      const recovered = await v2.signature.recoverSignature(decoded, { digest, chainId: 0, address: wallet }, provider)
      expect(v2.config.imageHash(recovered.config)).to.equal(imageHash)
      imageHash = nextImageHash
    }
  })

  it('Should find a migration', async () => {
    const address = '0x9efB45F2e6Bd007Bb47D94CcB461d0b88a1fc6d6'
    const fromVersion = 1
    const fromImageHash = '0xb0c9bf9b74e670cd5245ac196261e16c092b701ea769269aeb0b1507bb96f961'
    const toVersion = 2
    const toImageHash = '0xc289ea81fb71c62b4eb247c2e83b6897e1274e2ecd09d0cb780619cf4a4f204a'
    const chainId = 1

    const migration = await arweave.getMigration(address, fromImageHash, fromVersion, chainId)
    if (!migration) {
      throw new Error('migration not found')
    }

    expect(migration.tx.intent.wallet).to.equal(address)
    expect(BigInt(migration.tx.chainId)).to.equal(BigInt(chainId))
    expect(migration.fromVersion).to.equal(fromVersion)
    expect(migration.toVersion).to.equal(toVersion)
    expect(migration.toConfig.version).to.equal(toVersion)

    const toCoder = universal.genericCoderFor(migration.toVersion)
    expect(toCoder.config.imageHashOf(migration.toConfig)).to.equal(toImageHash)

    const fromCoder = universal.genericCoderFor(migration.fromVersion)
    const decoded = fromCoder.signature.decode(migration.tx.signature)
    const digest = commons.transaction.digestOfTransactions(migration.tx.nonce, migration.tx.transactions)
    const recovered = await fromCoder.signature.recover(decoded, { digest, chainId, address }, provider)
    expect(fromCoder.config.imageHashOf(recovered.config)).to.equal(fromImageHash)
  })

  it.skip('Should find the same configs as Sequence Sessions', async () => {
    const imageHashes = [
      '0x002f295ccfaf604ff09f200ad3282710f8b156811a03065dba66cf0902fff629',
      '0x015cadeea08b6f9ed3181b1560a1f801e58c02f4bb0d33d01b0c1ab7b07b7bb1',
      '0x042e86a1fe7f541e287b9053c483e21d059380b56d4baaa4161b0302cc55f22e',
      '0x08b597e0fc694da132d38db2b9e6c598ea85d786aba1c9830def5df0fec6da67',
      '0x08f915b8325e25003cc47e16fe144103655cda5e1cf43030345640c293feca98',
      '0x105823726957bbef0932076d4209de8e0198fd5da59042221583c6ba26ef2637',
      '0x1a13a8a34d18946b00b9368cf02f1cba3219eff2a18e76e4951d678824b34bdb',
      '0x1d018d98154312f501d1794ed77abd2e544a0a7c035638e965be846c0c347f37',
      '0x24f30c67a1f6228c2aa380e77999269a6203eab9ef60f3785ccd7a15ce199827',
      '0x2513cf57aca274bc40c2bd6492a1499e8b781d128e39b8dd85659b75687beb47',
      '0xeb718fb634b9f5e3a722825a25d4b48d3bbfe106d04efcbba6504fbf4539beed',
      '0xecc51be6a1c52bb41183df18c5df0185e20014ffafa04096d9da1148525e476e',
      '0xedfd70427e797f3865228c24d53903b0b529c544bf788000653070205e9548f2',
      '0xef028a928c04ec9759be984c2f0f72e0aa578efc2f402dbb6ca4893e981bbf41',
      '0xf148aa32b0cbd54c95610c8fb423b0506dd642ff659418a9ef64cfa50ef97489',
      '0xf2e32da98766f93d86284e029565d814954163c15d681013e53b11b66e13bb0f',
      '0xf4e8f9efa633938f6fbc02088074a9ee466178d59ff7ed8eb579ed7f14583dc5',
      '0xf54e5829545147e687b7fe39e078de34dbd60dd24096a2deea1bb8dd86d93936',
      '0xf5c2d2e6666cd2f04962df167eeeee5d217f731787a7d698b57142bb0da131d3',
      '0xff9a2779f55740f1f4011a6a00fee48e717cd51b75e32dd6a7db97e33a7b3d07'
    ]

    for (const imageHash of imageHashes) {
      const [arweaveConfig, sessionsConfig] = await Promise.all([
        arweave.configOfImageHash({ imageHash }),
        sessions.configOfImageHash({ imageHash })
      ])

      expect(arweaveConfig).to.deep.equal(sessionsConfig)
    }
  })

  it.skip('Should find the same deploy hashes as Sequence Sessions', async () => {
    const wallets = [
      '0x1982D04a8473d391d4D4cA0312420F13Bb8dE26e',
      '0x1dc2DA033d412d5E0D92f97a3157177dF41381D6',
      '0x213400e26b4aA36885Bcb29A8B7D67caeB0348EC',
      '0x329bD174c721bFa3A664Bde815dB33A7AA8b14a8',
      '0x36f8D1327F738608e275226A6De2D1720AF5C896',
      '0x41a0D39EFbB9a642c589abf2D501757D2f403470',
      '0x55Cfd699C5E105180473c5A0403a3b491c82fb22',
      '0x59756e67CFab5e1dFa1c7bCf7f5B04AbCAeb0B0F',
      '0x6B7CE863DfcCeAbc6bDbC3f73f6def0de81dfe27',
      '0x6Ce4229189988358073de1cd8AE7edFDf979635a',
      '0xCa9A0F02c0589D550f06F78AfF604A5405b90448',
      '0xD38A7FB85e76681cB409705622e877D11C7Cfe54',
      '0xd5b1C31f7626A8Bd206D744128dFE6401dd7D7F6',
      '0xDf29fF6EE710c4042dfE71bEeC1971Fca1F6A6F5',
      '0xEf87203423cA064A44CE2661Daf93051e2F423a2',
      '0xf3Da03EbBda88D28981c63Bd5ddA38d3eCff400a',
      '0xf563fbB21208C7c915ea7d28014D36B1F9acACa9',
      '0xFAE677fc10bDb6bF3C69Bb9DEEc6752cC7e06224',
      '0xfBF80a987857e6dcAF790B297fC9a4f97DbbfBB0',
      '0xfc9Adc5cd71F77e46a956F94df0fd5b0dF6Eef12'
    ]

    for (const wallet of wallets) {
      const [arweaveWallet, sessionsWallet] = await Promise.all([
        arweave.imageHashOfCounterfactualWallet({ wallet }),
        sessions.imageHashOfCounterfactualWallet({ wallet })
      ])

      expect(arweaveWallet?.imageHash).to.equal(sessionsWallet?.imageHash)
      expect(arweaveWallet?.context).to.deep.equal(sessionsWallet?.context)
    }
  })

  it.skip('Should find the same wallets as Sequence Sessions', async () => {
    const signers = [
      '0x079cc5A64Fa4Bdd928bbF0EaBaf7BE91D633abf5',
      '0x18510092ee248b1A2BBaB66C5d223EBa784693BA',
      '0x1BA6a414d3C45a8E21FBEf451882170d0f6807F7',
      '0x1Cd69D558cbD121F6C4DdF11db2CaCC142705a20',
      '0x24270586957918c5C075E970A208387C888C4dD8',
      '0x289cF67aeF2000DEcafb525103d8aDE044996D45',
      '0x37Fd684c78b74b633CA43Ca5418f6f80827fB0fD',
      '0x5373B3264EbbF0471FE4CC8B63f30446Cc03F6ad',
      '0x553390e8B3dd2694Ea50bE9972C0D66b320bBa27',
      '0x58AF1d8567BE0629A9961d8B3e06234B0f731187',
      '0xb478671F3705cC2a3A1F47326F2Ef93853b79cf2',
      '0xbb8FAEc13852b263644e75fd568B422055A8e8DC',
      '0xbcB1EFB67f277cBbBeB886D6248ab222f3ef2195',
      '0xc37c114B99242D1F83fFD964236f45042eD8c162',
      '0xCa968ebc798feaeE466e73C872f085C3A2c9b7D9',
      '0xcD2C0E8b8372FfF16caa0a29F9336F4dFB4D2EA1',
      '0xd4c04c7392617D85b6FF33E203714C6Fd46336b4',
      '0xe7D97e2d43900297a7537B0eD3B6C27306f6aDC0',
      '0xea5dE55520f4cca364AB9Ed5613a11aa1e5C977E',
      '0xFf6bEB351a06f35BFD6074d6Cfe34fcb8734F675'
    ]

    for (const signer of signers) {
      const [arweaveWallets, sessionsWallets] = await Promise.all([
        arweave.walletsOfSigner({ signer }),
        sessions.walletsOfSigner({ signer })
      ])

      expect(Object.fromEntries(arweaveWallets.map(({ wallet, proof }) => [wallet, proof]))).to.deep.equal(
        Object.fromEntries(sessionsWallets.map(({ wallet, proof }) => [wallet, proof]))
      )
    }
  })

  it.skip('Should find the same config updates as Sequence Sessions', async () => {
    const updates = [
      {
        wallet: '0x1982D04a8473d391d4D4cA0312420F13Bb8dE26e',
        fromImageHash: '0x8073858470016c4fdee9d3ad7c929e81cb19668a73fde061f00645228676e8dd'
      },
      {
        wallet: '0x213400e26b4aA36885Bcb29A8B7D67caeB0348EC',
        fromImageHash: '0x653ad79e81e77bbf9aeca4740a12dbe260e17abde4114c4a4056d7c8ab605270'
      },
      {
        wallet: '0x329bD174c721bFa3A664Bde815dB33A7AA8b14a8',
        fromImageHash: '0x47eb2d6796c08e627d886ce5dd88f4aefbda5ab6209a5e35ded2f5ea95a5f05a'
      },
      {
        wallet: '0x36f8D1327F738608e275226A6De2D1720AF5C896',
        fromImageHash: '0xacbf7d62011d908d4cdfc96651be39b77d56f8e8048e993a57470724eb6049be'
      },
      {
        wallet: '0x41a0D39EFbB9a642c589abf2D501757D2f403470',
        fromImageHash: '0x9cd23aa8bf0945ec412aa2c815ffbb77341a869a0c3d031af0bb0b82faa1fc75'
      },
      {
        wallet: '0x55Cfd699C5E105180473c5A0403a3b491c82fb22',
        fromImageHash: '0xf54e5829545147e687b7fe39e078de34dbd60dd24096a2deea1bb8dd86d93936'
      },
      {
        wallet: '0x59756e67CFab5e1dFa1c7bCf7f5B04AbCAeb0B0F',
        fromImageHash: '0x2a0b27a28d39ec7b4ad61edc83b55d9b8375252ad48c838252d937a7f4afcf89'
      },
      {
        wallet: '0x6B7CE863DfcCeAbc6bDbC3f73f6def0de81dfe27',
        fromImageHash: '0x08f915b8325e25003cc47e16fe144103655cda5e1cf43030345640c293feca98'
      },
      {
        wallet: '0x6Ce4229189988358073de1cd8AE7edFDf979635a',
        fromImageHash: '0xf4e8f9efa633938f6fbc02088074a9ee466178d59ff7ed8eb579ed7f14583dc5'
      },
      {
        wallet: '0x801DC9A5F00f781cA0f1ca56dbA68DA69fB07cdC',
        fromImageHash: '0xab5e99dc4fc094955f547bce2b8e0991845aa17f4fab47e3d212131474982fd6'
      },
      {
        wallet: '0x82B772b0fDb7Efb31B7DDD8d06C7C10fa1Dca383',
        fromImageHash: '0x99da13df61af5b72011ab2e81aea9c4960c58344f7e536a5db27ce887acf0799'
      },
      {
        wallet: '0x84ac87bc06De4e1456B9df2C2496bF9a12b86C10',
        fromImageHash: '0xc36416d54ec63920066c441686788888ee5505cd9137a006e14419940d53222d'
      },
      {
        wallet: '0x8af66F10b45AE8eba55C819a702344c407fD97fE',
        fromImageHash: '0x890364a08ba76febfc67d63507a362c00c71cf4cf67b88e68f6952a9b8b95c66'
      },
      {
        wallet: '0x8e17D9C9dF4271C9a3cb0D7635004257f9805A6F',
        fromImageHash: '0x4aade79c43aa094d77d98f5e2f70efb28cc4670614ff5894713c3bb11d32d9cf'
      },
      {
        wallet: '0x93fe4617B114F4018eaCfBB7eAb00A06f8C54E2D',
        fromImageHash: '0xe9ab45294e8e22a456ff493201bd6f3329a6875193a2b1afc2e357c813ce0842'
      },
      {
        wallet: '0x9876DD582d28a527586fee03311B4a57461fE4c7',
        fromImageHash: '0x7bf4d1c4443f505e86495c4b1666e9484b9636ec53ef166695a6caf3ed03b3d6'
      },
      {
        wallet: '0x9A203aBD53719C04ad7E1A5e587ea636368A6ed1',
        fromImageHash: '0xef028a928c04ec9759be984c2f0f72e0aa578efc2f402dbb6ca4893e981bbf41'
      },
      {
        wallet: '0x9BdD9F17370d5690230Ba6CdfCE6D40c0dE7Fb49',
        fromImageHash: '0xd0fdc647d1fc584cb53bb2798abfd887e61aab0b038caa201b96bebd39e7565f'
      },
      {
        wallet: '0x9efB45F2e6Bd007Bb47D94CcB461d0b88a1fc6d6',
        fromImageHash: '0x2693f1f40c73d0c1f361f472cd1ec4fac9daa2d5232ff5f5b87ec56c1d3e7e20'
      },
      {
        wallet: '0xa53f6C371539F53Bb4DbcA0f1351eA7AA7F488c5',
        fromImageHash: '0x1d018d98154312f501d1794ed77abd2e544a0a7c035638e965be846c0c347f37'
      }
    ]

    for (const longestPath of [false, true]) {
      for (const update of updates) {
        const [arweaveUpdates, sessionsUpdates] = await Promise.all([
          arweave.loadPresignedConfiguration({ ...update, longestPath }),
          sessions.loadPresignedConfiguration({ ...update, longestPath })
        ])

        let imageHash = update.fromImageHash

        for (const i in arweaveUpdates) {
          const arweaveUpdate = arweaveUpdates[i]
          const sessionsUpdate = sessionsUpdates[i]

          expect(arweaveUpdate.wallet).to.equal(update.wallet)
          expect(sessionsUpdate.wallet).to.equal(update.wallet)
          expect(arweaveUpdate.nextImageHash).to.equal(sessionsUpdate.nextImageHash)

          const nextImageHash = arweaveUpdate.nextImageHash

          const arweaveSignature = v2.signature.decodeSignature(arweaveUpdate.signature)
          const sessionsSignature = v2.signature.decodeSignature(sessionsUpdate.signature)

          const digest = v2.chained.hashSetImageHash(nextImageHash)

          const { config: arweaveConfig } = await v2.signature.recoverSignature(
            arweaveSignature,
            { digest, chainId: 0, address: update.wallet },
            provider
          )

          const { config: sessionsConfig } = await v2.signature.recoverSignature(
            sessionsSignature,
            { digest, chainId: 0, address: update.wallet },
            provider
          )

          expect(v2.config.imageHash(arweaveConfig)).to.equal(v2.config.imageHash(sessionsConfig))

          imageHash = nextImageHash
        }
      }
    }
  })

  it.skip('Should find the same migrations as Sequence Sessions', async () => {
    const migrations = [
      {
        address: '0x1dc2DA033d412d5E0D92f97a3157177dF41381D6',
        fromVersion: 1,
        fromImageHash: '0xd0cca2788f80d85e93a0b3dd2af2e5962979d162931ec9c4537318be0c8ca312',
        chainId: 1
      },
      {
        address: '0x213400e26b4aA36885Bcb29A8B7D67caeB0348EC',
        fromVersion: 1,
        fromImageHash: '0xd94d8b1eaeaa3e2053b3421898e7925ebeef760881d9866c0096a3f97ed78f59',
        chainId: 1
      },
      {
        address: '0x9efB45F2e6Bd007Bb47D94CcB461d0b88a1fc6d6',
        fromVersion: 1,
        fromImageHash: '0xb0c9bf9b74e670cd5245ac196261e16c092b701ea769269aeb0b1507bb96f961',
        chainId: 1
      },
      {
        address: '0xb0E931FB27cc7149Ce0B8585739414Bf0866E0d2',
        fromVersion: 1,
        fromImageHash: '0x784e8115d0da9724aabe8ce4b6c27a2750ca3bc0ce51f4404c0aee8a2856859d',
        chainId: 1
      },
      {
        address: '0xc3527Da8b07E49CA6cCCC773C8D032bd4a77D464',
        fromVersion: 1,
        fromImageHash: '0xa88c665c0507894572288103cb88eea73e791f686b9eb2a4c80b1ca552cd1650',
        chainId: 1
      },
      {
        address: '0xCa9A0F02c0589D550f06F78AfF604A5405b90448',
        fromVersion: 1,
        fromImageHash: '0xbaf93699b3cb6214742cd6cccae0a6d1a0240ca4e03bf491b15707cdf46eca24',
        chainId: 1
      },
      {
        address: '0xd5b1C31f7626A8Bd206D744128dFE6401dd7D7F6',
        fromVersion: 1,
        fromImageHash: '0xcf813d102720b67781e784e852e624f86a5bb92a9a37234e2a89390b0b814480',
        chainId: 1
      },
      {
        address: '0xEf87203423cA064A44CE2661Daf93051e2F423a2',
        fromVersion: 1,
        fromImageHash: '0x338a2e6e1533e902f698e4623afc9b78f7c1b955f1e9c99ff4a4ee914dbbb401',
        chainId: 1
      }
    ]

    for (const { address, fromVersion, fromImageHash, chainId } of migrations) {
      const [arweaveMigration, sessionsMigration] = await Promise.all([
        arweave.getMigration(address, fromImageHash, fromVersion, chainId),
        sessions.getMigration(address, fromImageHash, fromVersion, chainId)
      ])

      expect(arweaveMigration).to.deep.equal(sessionsMigration)
    }
  })
})
