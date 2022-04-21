import { sequenceContext } from "@0xsequence/network"
import { Account, recoverConfig, recoverConfigFromDigest, Wallet } from "@0xsequence/wallet"
import { expect } from "chai"
import { BigNumber, ethers, Signer } from "ethers"
import { addressOf, ConfigTracker, DebugConfigTracker, decodeSignature, decodeSignaturePart, imageHash, LocalConfigTracker, SESSIONS_SPACE, staticRecoverConfig, staticRecoverConfigPart, WalletConfig } from "../src"
import { walletContracts } from "@0xsequence/abi"
import { Interface } from "ethers/lib/utils"
import { digestOfTransactions, digestOfTransactionsNonce, encodeNonce, packMetaTransactionsData, unpackMetaTransactionData } from "@0xsequence/transactions"
import { subDigestOf } from "@0xsequence/utils"
import { PresignedConfigUpdate } from "../src/tracker/config-tracker"


describe.only('Config tracker', function () {
  const sessionNonce = encodeNonce(SESSIONS_SPACE, 0)

  let configTracker: ConfigTracker
  let mainModuleInterface: Interface
  let mainModuleUpgradableInterface: Interface
  let sessionUtilsInterface: Interface

  function randomConfigWithSigners(
    signers = Math.max(1, Math.floor(Math.random() * 50)),
    extras = Math.max(1, Math.floor(Math.random() * 50))
  ): {
    config: WalletConfig,
    signers: ethers.Wallet[]
  } {
    const s = new Array(signers).fill(0).map(() => ethers.Wallet.createRandom())
    const f = new Array(extras).fill(0).map(() => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20))))

    // Assign a random weight to each signer
    // in such a way that all of them are above the threshold
    const weights = s.map(() => ethers.BigNumber.from(Math.floor(Math.random() * 20)))
    const totalWeight = weights.reduce((acc, w) => acc.add(w), ethers.BigNumber.from(0))
    let threshold = totalWeight.mul(100).div(110)
    if (threshold.lt(1)) {
      threshold = ethers.BigNumber.from(1)
    } else if (threshold.gt(65534)) {
      threshold = ethers.BigNumber.from(65534)
    }

    const ss = s.map((s, i) => ({
      address: s.address,
      weight: weights[i].toNumber()
    }))

    const fs = f.map((f) => ({
      address: f,
      weight: ethers.BigNumber.from(Math.floor(Math.random() * 20)).toNumber()
    }))

    // Combine fs and ss and shuffle
    const signersAndExtras = fs.concat(ss)
    const shuffled = signersAndExtras.sort(() => 0.5 - Math.random())

    const config = {
      threshold: threshold.toNumber(),
      signers: shuffled,
    }

    return {
      config,
      signers: s
    }
  }

  function randomConfig(
    threshold?: number,
    signers?: number
  ): WalletConfig {
    const { config } = randomConfigWithSigners(0, signers)
    if (threshold) {
      config.threshold = threshold
    } else {
      config.threshold = config.signers.reduce((acc, s) => acc + s.weight, 0)
    }

    return config
  }

  function expectValidSessionTx(presigned: PresignedConfigUpdate, args: {
    wallet: string,
    fromConfig: WalletConfig,
    newConfig: WalletConfig,
    chainId: ethers.BigNumberish,
    update?: string,
    timestamp?: number,
    margin?: number
  }) {
    const { wallet, fromConfig, newConfig, chainId, update } = args

    // Generic checks
    const newImageHash = imageHash(newConfig)
    expect(presigned.chainId.toString()).to.equal(chainId.toString())
    expect(presigned.signature).to.not.equal("")
    expect(presigned.body.wallet).to.equal(wallet)
    expect(presigned.body.newImageHash).to.deep.equal(newImageHash)
    expect(presigned.body.gapNonce.toNumber()).to.approximately(args.timestamp || Date.now(), args.margin || 5000)
    expect(presigned.body.tx).to.include(newImageHash.slice(2))
    expect(presigned.body.tx).to.include(sequenceContext.sessionUtils.toLowerCase().slice(2))
    expect(presigned.body.tx).to.include(presigned.body.gapNonce.toHexString().slice(2))
    expect(presigned.body.nonce).to.deep.equal(sessionNonce)

    // Decode tx data
    const unpacked = unpackMetaTransactionData(presigned.body.tx)

    // Signature verification
    // Recover config should match config
    const txDigest = digestOfTransactionsNonce(sessionNonce, ...unpacked)
    const subDigest = subDigestOf(wallet, chainId, txDigest)
    const decodedSignature = decodeSignature(presigned.signature)
    const { config: recoveredConfig } = staticRecoverConfig(subDigest, decodedSignature, 1)
    expect(recoveredConfig).to.deep.equal(fromConfig)

    // If update it should have 3 txs, otherwise just 2
    expect(unpacked.length).to.eq(update ? 3 : 2)

    // If update, then first transaction should be the update
    if (update) {
      expect(presigned.body.tx).to.include(update.toLowerCase().slice(2))
      expect(presigned.body.update).to.equal(update)

      expect(unpacked[0].to).to.equal(wallet)
      expect(unpacked[0].delegateCall).to.equal(false)
      expect(unpacked[0].revertOnError).to.equal(true)
      expect(unpacked[0].value.toString()).to.equal('0')
      expect(unpacked[0].gasLimit.toString()).to.equal('0')

      const expectedData = mainModuleInterface.encodeFunctionData(
        mainModuleInterface.getFunction('updateImplementation'), [update]
      )
  
      expect(unpacked[0].data).to.equal(expectedData)
    }

    // Penultimate transaction should be updateImageHash
    const i = unpacked.length - 2
    expect(unpacked[i].to).to.equal(wallet)
    expect(unpacked[i].delegateCall).to.equal(false)
    expect(unpacked[i].revertOnError).to.equal(true)
    expect(unpacked[i].value.toString()).to.equal('0')
    expect(unpacked[i].gasLimit.toString()).to.equal('0')

    const data = mainModuleUpgradableInterface.encodeFunctionData(
      mainModuleUpgradableInterface.getFunction('updateImageHash'), [newImageHash]
    )

    expect(unpacked[i].data).to.equal(data)

    // Last transaction should be requireSessionNonce
    const j = unpacked.length - 1
    expect(unpacked[j].to).to.equal(sequenceContext.sessionUtils)
    expect(unpacked[j].delegateCall).to.equal(true)
    expect(unpacked[j].revertOnError).to.equal(true)
    expect(unpacked[j].value.toString()).to.equal('0')
    expect(unpacked[j].gasLimit.toString()).to.equal('0')

    const data2 = sessionUtilsInterface.encodeFunctionData(
      sessionUtilsInterface.getFunction('requireSessionNonce'), [presigned.body.gapNonce]
    )
    expect(unpacked[j].data).to.equal(data2)
  }

  before(() => {
    configTracker = new LocalConfigTracker()
    mainModuleInterface = new Interface(walletContracts.mainModule.abi)
    mainModuleUpgradableInterface = new Interface(walletContracts.mainModuleUpgradable.abi)
    sessionUtilsInterface = new Interface(walletContracts.sessionUtils.abi)
  })

  it("Should return undefined if config is not registered", async () => {
    const imageHash = "0xaf786307f2980ed0d0c78df4c2de3948907d5fefc008567a05d47a3dbb095f3b"
    const config = await configTracker.configOfImageHash({ imageHash })
    expect(config).to.be.undefined
  })

  it("Should save counter factual wallet", async () => {
    const config = randomConfig()
    const ih = imageHash(config)
    const context = sequenceContext

    await configTracker.saveCounterFactualWallet({ imageHash: ih, context })

    const wallet = addressOf(ih, context)
    const rih = await configTracker.imageHashOfCounterFactualWallet({ context, wallet })
    expect(rih).to.be.equal(ih)

    // Should return undefined for random context
    const badContext = { ...context, factory: ethers.Wallet.createRandom().address }
    const bres = await configTracker.imageHashOfCounterFactualWallet({ context: badContext, wallet })
    expect(bres).to.be.undefined

    // Should return undefined for random address
    const badWallet = ethers.Wallet.createRandom().address
    const bres2 = await configTracker.imageHashOfCounterFactualWallet({ context, wallet: badWallet })
    expect(bres2).to.be.undefined
  })

  it("Should save configurations", async () => {
    const config = randomConfig()
    configTracker.saveWalletConfig({ config: config })

    const resconfig = await configTracker.configOfImageHash({ imageHash: imageHash(config) })
    expect(resconfig).to.be.deep.equal(config)
  })

  it("Should save the same configuration twice", async () => {
    const config = randomConfig()

    configTracker.saveWalletConfig({ config })
    configTracker.saveWalletConfig({ config })

    const resconfig = await configTracker.configOfImageHash({ imageHash: imageHash(config) })
    expect(config).to.be.deep.equal(resconfig)
  })

  it("Should retrieve counter factual wallet address", async () => {
    const config = randomConfig()
    const ih = imageHash(config)
    const wallet = addressOf(ih, sequenceContext)

    await configTracker.saveCounterFactualWallet({ imageHash: ih, context: sequenceContext })

    const res = await configTracker.imageHashOfCounterFactualWallet({ wallet, context: sequenceContext })
    expect(res).to.be.equal(ih)
  })

  it("Should store presigned wallet update (with upgrade) in a single chain", async () => {
    const signer = ethers.Wallet.createRandom()

    const config = {
      threshold: 1,
      signers: [{
        address: signer.address,
        weight: 1
      }]
    }
    const fromImageHash = imageHash(config)

    const newConfig = randomConfig()
    const newImageHash = imageHash(newConfig)

    const account = await Account.create({ configTracker }, config, signer)
    await account.updateConfig(newConfig, 1)

    const res1 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash,
      chainId: 1,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })

    expect(res1.length).to.equal(1)
    expectValidSessionTx(res1[0], {
      wallet: account.address,
      fromConfig: config,
      newConfig,
      chainId: 1,
      update: sequenceContext.mainModuleUpgradable
    })

    // Should return empty for other chains
    const res2 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash,
      chainId: 2,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })
    expect(res2).to.deep.equal([])

    // Should return empty if no update is requested
    const res3 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash,
      chainId: 1,
      prependUpdate: []
    })
    expect(res3).to.deep.equal([])

    // Should return empty from invalid imageHash
    const res4 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      chainId: 1,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })
    expect(res4).to.deep.equal([])

    // Should return empty from invalid wallet
    const res5 = await configTracker.loadPresignedConfiguration({
      wallet: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
      fromImageHash,
      chainId: 1,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })

    expect(res5).to.deep.equal([])
  })

  it("Should store presigned wallet update (with upgrade) in multiple chains", async () => {
    const signer = ethers.Wallet.createRandom()

    const config = {
      threshold: 1,
      signers: [{
        address: signer.address,
        weight: 1
      }]
    }
    const fromImageHash = imageHash(config)

    const newConfig = randomConfig()
    const newImageHash = imageHash(newConfig)

    const account = await Account.create({ configTracker }, config, signer)
    await account.updateConfig(newConfig, 1, [2, 3, 4, 100])

    await Promise.all(([1, 2, 3, 4, 100]).map(async (chainId) => {
      const res = await configTracker.loadPresignedConfiguration({
        wallet: account.address,
        fromImageHash,
        chainId: chainId,
        prependUpdate: [sequenceContext.mainModuleUpgradable]
      })
  
      expect(res.length).to.equal(1)
      expectValidSessionTx(res[0], {
        wallet: account.address,
        fromConfig: config,
        newConfig,
        chainId,
        update: sequenceContext.mainModuleUpgradable
      })
    }))

    // Should return empty for other chains
    const res2 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash,
      chainId: 200,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })
    expect(res2).to.deep.equal([])

    // Should return empty if no update is requested
    const res3 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash,
      chainId: 1,
      prependUpdate: []
    })
    expect(res3).to.deep.equal([])

    // Should return empty from invalid imageHash
    const res4 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      chainId: 1,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })
    expect(res4).to.deep.equal([])

    // Should return empty from invalid wallet
    const res5 = await configTracker.loadPresignedConfiguration({
      wallet: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
      fromImageHash,
      chainId: 1,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })

    expect(res5).to.deep.equal([])
  })

  it("Should construct presigned transaction with alternative config", async () => {
    const signer1 = ethers.Wallet.createRandom()
    const signer2 = ethers.Wallet.createRandom()
    const signer3 = ethers.Wallet.createRandom()

    const config = {
      threshold: 4,
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

    const newConfig = randomConfig()
    const account = await Account.create({ configTracker }, config, signer1, signer2)
    await account.updateConfig(newConfig, 1)

    // Generate alternative "from" config
    // but with enough signers anyway
    const altConfig = {
      threshold: 3,
      signers: [{
        address: signer1.address,
        weight: 2
      }, {
        address: signer2.address,
        weight: 1
      }, {
        address: signer3.address,
        weight: 1
      }, {
        address: ethers.Wallet.createRandom().address,
        weight: 100
      }]
    }

    // Store config, otherwise tracker can't route from it
    await configTracker.saveWalletConfig({ config: altConfig })

    const res1 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      fromImageHash: imageHash(altConfig),
      chainId: 1,
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })

    expect(res1.length).to.equal(1)
    expectValidSessionTx(res1[0], {
      wallet: account.address,
      fromConfig: altConfig,
      newConfig,
      chainId: 1,
      update: sequenceContext.mainModuleUpgradable
    })
  })

  it("Should return wallets for signers (after update)", async () => {
    const signer1 = ethers.Wallet.createRandom()
    const signer2 = ethers.Wallet.createRandom()
    const signer3 = ethers.Wallet.createRandom()

    const config = {
      threshold: 4,
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

    const newConfig2 = randomConfig()

    const account = await Account.create({ configTracker }, config, signer1, signer2)
    await account.updateConfig(newConfig2, 1)

    const res1 = await configTracker.walletsOfSigner({ signer: signer1.address })
    expect(res1.length).to.equal(1)
    expect(res1[0].wallet).to.equal(account.address)
    expect(res1[0].proof.chainId.toString()).to.equal("1")
  
    const subDigest1 = subDigestOf(res1[0].wallet, res1[0].proof.chainId, res1[0].proof.digest)
    const part1 = staticRecoverConfigPart(subDigest1, res1[0].proof.signature, res1[0].proof.chainId)
    expect(part1.signer).to.equal(signer1.address)

    const res2 = await configTracker.walletsOfSigner({ signer: signer2.address })
    expect(res2.length).to.equal(1)
    expect(res2[0].wallet).to.equal(account.address)
    expect(res2[0].proof.chainId.toString()).to.equal("1")

    const subDigest2 = subDigestOf(res2[0].wallet, res2[0].proof.chainId, res2[0].proof.digest)
    const part2 = staticRecoverConfigPart(subDigest2, res2[0].proof.signature, res2[0].proof.chainId)
    expect(part2.signer).to.equal(signer2.address)

    const res3 = await configTracker.walletsOfSigner({ signer: signer3.address })
    // Should be empty for signer3 because is not signing
    expect(res3.length).to.equal(0)

    // 2 subdigests should be equal
    expect(subDigest1).to.equal(subDigest2)
  })

  it("Should return wallets for signers (without update, just witness)", async () => {
    const signer1 = ethers.Wallet.createRandom()
    const signer2 = ethers.Wallet.createRandom()
    const signer3 = ethers.Wallet.createRandom()

    const config = {
      threshold: 4,
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

    const account = await Account.create({ configTracker }, config, signer1, signer2)
    const witnessMessage = `0xSequence witness: ${ethers.utils.hexlify(ethers.utils.randomBytes(32))}`
    const witnessDigest = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(witnessMessage))
    const signed = await account.signMessage(witnessDigest, 1, undefined, true)
    await configTracker.saveWitness({ wallet: account.address, digest: witnessDigest, signatures: [{ signature: signed, chainId: 1 }] })

    const res1 = await configTracker.walletsOfSigner({ signer: signer1.address })
    expect(res1.length).to.equal(1)
    expect(res1[0].wallet).to.equal(account.address)
    expect(res1[0].proof.chainId.toString()).to.equal("1")
  
    const subDigest1 = subDigestOf(res1[0].wallet, res1[0].proof.chainId, res1[0].proof.digest)
    const part1 = staticRecoverConfigPart(subDigest1, res1[0].proof.signature, res1[0].proof.chainId)
    expect(part1.signer).to.equal(signer1.address)

    const res2 = await configTracker.walletsOfSigner({ signer: signer2.address })
    expect(res2.length).to.equal(1)
    expect(res2[0].wallet).to.equal(account.address)
    expect(res2[0].proof.chainId.toString()).to.equal("1")

    const subDigest2 = subDigestOf(res2[0].wallet, res2[0].proof.chainId, res2[0].proof.digest)
    const part2 = staticRecoverConfigPart(subDigest2, res2[0].proof.signature, res2[0].proof.chainId)
    expect(part2.signer).to.equal(signer2.address)

    const res3 = await configTracker.walletsOfSigner({ signer: signer3.address })
    // Should be empty for signer3 because is not signing
    expect(res3.length).to.equal(0)

    // 2 subdigests should be equal
    expect(subDigest1).to.equal(subDigest2)
  })

  it("Should return presigned wallet update with 2 jumps", async () => {
    const signer1 = ethers.Wallet.createRandom()
    const signer2 = ethers.Wallet.createRandom()
    const signer3 = ethers.Wallet.createRandom()

    const config = {
      threshold: 4,
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

    const signer4 = ethers.Wallet.createRandom()
    const signer5 = ethers.Wallet.createRandom()
    const signer6 = ethers.Wallet.createRandom()
    const signer7 = ethers.Wallet.createRandom()

    const config2 = {
      threshold: 5,
      signers: [{
        address: signer4.address,
        weight: 2
      }, {
        address: signer5.address,
        weight: 1
      }, {
        address: signer6.address,
        weight: 9
      }, {
        address: signer7.address,
        weight: 2
      }]
    }

    const config3 = randomConfig()

    const account = await Account.create({ configTracker }, config, signer1, signer3)
    await account.updateConfig(config2, 1)
    await account.useSigners(signer4, signer5, signer7).updateConfig(config3, 1)

    const res = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      chainId: 1,
      fromImageHash: imageHash(config),
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })

    expect(res.length).to.equal(2)
    expectValidSessionTx(res[0], {
      wallet: account.address,
      fromConfig: config,
      newConfig: config2,
      chainId: 1,
      update: sequenceContext.mainModuleUpgradable
    })

    expectValidSessionTx(res[1], {
      wallet: account.address,
      fromConfig: config2,
      newConfig: config3,
      chainId: 1
    })

    // Should return a single jump going from config2 to config3
    const res2 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      chainId: 1,
      fromImageHash: imageHash(config2),
      prependUpdate: []
    })

    expect(res2.length).to.equal(1)
    expectValidSessionTx(res2[0], {
      wallet: account.address,
      fromConfig: config2,
      newConfig: config3,
      chainId: 1
    })
  })

  it("Should handle presigned route with two alternative paths", async () => {
    // Config A --> Config B -> Config C -> Config D
    //          \                       /
    //           -> Config E -----------

    const { config: configA, signers: signersA } = randomConfigWithSigners(3, 5)
    const { config: configB, signers: signersB } = randomConfigWithSigners(2, 1)
    const { config: configC, signers: signersC } = randomConfigWithSigners(7, 0)
    const { config: configE, signers: signersE } = randomConfigWithSigners(5, 10)
    const { config: configD } = randomConfigWithSigners(5, 10)

    const account = await Account.create({ configTracker }, configA, ...signersA)
    await account.updateConfig(configB, 1)
    await account.useSigners(...signersB).updateConfig(configC, 1)
    await account.useSigners(...signersC).updateConfig(configD, 1)

    const timestamp = Date.now()
    const margin = 10000

    // Use a different config tracker, force the fork
    const tmpConfigTracker = new LocalConfigTracker()
    const account2 = await Account.create({ configTracker: tmpConfigTracker }, configA, ...signersA)
    await account2.updateConfig(configE, 1)
    await account2.useSigners(...signersE).updateConfig(configD, 1)

    // Send alternative presigned configuration to main configTracker
    const pre = await tmpConfigTracker.loadPresignedConfiguration({
      wallet: account2.address,
      chainId: 1,
      fromImageHash: imageHash(configA),
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })

    expect(pre.length).to.equal(2)

    await configTracker.savePresignedConfiguration({
      wallet: account2.address,
      config: configE,
      tx: pre[0].body,
      signatures: [{
        chainId: ethers.BigNumber.from(1),
        signature: pre[0].signature
      }]
    })

    await configTracker.savePresignedConfiguration({
      wallet: account2.address,
      config: configD,
      tx: pre[1].body,
      signatures: [{
        chainId: ethers.BigNumber.from(1),
        signature: pre[1].signature
      }]
    })

    const res1 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      chainId: 1,
      fromImageHash: imageHash(configA),
      prependUpdate: [sequenceContext.mainModuleUpgradable]
    })

    expect(res1.length).to.equal(2)
    expectValidSessionTx(res1[0], {
      wallet: account.address,
      fromConfig: configA,
      newConfig: configE,
      chainId: 1,
      update: sequenceContext.mainModuleUpgradable,
      timestamp,
      margin
    })
    expectValidSessionTx(res1[1], {
      wallet: account.address,
      fromConfig: configE,
      newConfig: configD,
      chainId: 1,
      timestamp,
      margin
    })

    // From config B is B -> C -> D (without update)
    const res2 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      chainId: 1,
      fromImageHash: imageHash(configB),
      prependUpdate: []
    })

    expect(res2.length).to.equal(2)
    expectValidSessionTx(res2[0], {
      wallet: account.address,
      fromConfig: configB,
      newConfig: configC,
      chainId: 1,
      timestamp,
      margin
    })
    expectValidSessionTx(res2[1], {
      wallet: account.address,
      fromConfig: configC,
      newConfig: configD,
      chainId: 1,
      timestamp,
      margin
    })

    // From config E is E -> D (without update)
    const res3 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      chainId: 1,
      fromImageHash: imageHash(configE),
      prependUpdate: []
    })

    expect(res3.length).to.equal(1)
    expectValidSessionTx(res3[0], {
      wallet: account.address,
      fromConfig: configE,
      newConfig: configD,
      chainId: 1,
      timestamp,
      margin
    })

    // From config C is C -> D (without update)
    const res4 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      chainId: 1,
      fromImageHash: imageHash(configC),
      prependUpdate: []
    })

    expect(res4.length).to.equal(1)
    expectValidSessionTx(res4[0], {
      wallet: account.address,
      fromConfig: configC,
      newConfig: configD,
      chainId: 1,
      timestamp,
      margin
    })

    // From config D there is no update
    const res5 = await configTracker.loadPresignedConfiguration({
      wallet: account.address,
      chainId: 1,
      fromImageHash: imageHash(configD),
      prependUpdate: []
    })

    expect(res5.length).to.equal(0)
  })
})
