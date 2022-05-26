import { sequenceContext, WalletContext } from "@0xsequence/network"
import { digestOfTransactionsNonce, encodeNonce, readSequenceNonce, unpackMetaTransactionData } from "@0xsequence/transactions"
import { subDigestOf } from "@0xsequence/utils"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { ConfigTrackerDatabase } from "."
import { ConfigTracker, MemoryConfigTrackerDb, SESSIONS_SPACE, SignaturePart } from ".."
import { addressOf, DecodedSignature, DecodedSignaturePart, decodeSignature, encodeSignature, encodeSignaturePart, imageHash, staticRecoverConfig } from "../.."
import { WalletConfig } from "../../config"
import { AssumedWalletConfigs, ExportableConfigTracker, ExporteConfigTrackerData, PresignedConfigUpdate, PresignedConfigurationPayload, TransactionBody } from "../config-tracker"
import { getUpdateImplementation, isValidWalletUpdate } from "../utils"
import { Searcher } from "./searcher"


export class LocalConfigTracker implements ConfigTracker, ExportableConfigTracker {
  constructor(
    private database: ConfigTrackerDatabase = new MemoryConfigTrackerDb(),
    public context: WalletContext = sequenceContext,
    public walletConfigs: AssumedWalletConfigs = {}
  ) {}

  saveWalletConfig = async (args: {
    config: WalletConfig
  }): Promise<void> => {
    return this.database.saveWalletConfig({ config: { threshold: args.config.threshold, signers: args.config.signers }, imageHash: imageHash(args.config) })
  }

  configOfImageHash = async (args: { imageHash: string; }): Promise<WalletConfig | undefined> => {
    const config = await this.database.configOfImageHash(args)
    return config ? {
      threshold: config?.threshold,
      signers: config?.signers
    } : undefined
  }

  saveCounterFactualWallet = async (args: {
    imageHash: string
    context: WalletContext
  }): Promise<void> => {
    return this.database.saveCounterFactualWallet({ ...args, wallet: addressOf(args.imageHash, args.context, true) })
  }

  imageHashOfCounterFactualWallet = async (args: {
    context: WalletContext
    wallet: string
  }): Promise<string | undefined> => {
    return this.database.imageHashOfCounterFactualWallet(args)
  }

  savePresignedConfiguration = async (args: {
    wallet: string
    config: WalletConfig
    tx: TransactionBody
    signatures: {
      chainId: BigNumber
      signature: string
    }[]
  }): Promise<void> => {
    // Unpack transaction body
    const txs = unpackMetaTransactionData(args.tx.tx)

    // Check validity of the provided transaction bodies
    if (!isValidWalletUpdate({ wallet: args.wallet, txs, newConfig: args.config, context: this.context, gapNonce: args.tx.gapNonce })) {
      throw new Error(`Invalid transaction body ${JSON.stringify(args)}`)
    }

    let body = { ...args.tx }
    const updateImpl = getUpdateImplementation(txs[0])
    if (updateImpl) {
      if (args.tx.update) {
        if (args.tx.update !== updateImpl) {
          throw new Error(`Invalid transaction body, expected update to ${updateImpl}, got ${args.tx.update}`)
        }
      } else {
        body = { ...body, update: updateImpl }
      }
    } else if(args.tx.update) {
      throw new Error(`Invalid transaction body, update unexpected ${JSON.stringify(args)}`)
    }

    // Transaction nonce should be
    // expected session nonce (SessionSpace and zero)
    const expectedNonce = encodeNonce(SESSIONS_SPACE, 0)
    if (!expectedNonce.eq(args.tx.nonce)) {
      throw new Error(`Invalid transaction nonce ${args.tx.nonce.toString()} expected ${expectedNonce.toString()}`)
    }

    // Get digest of transaction
    const digest = digestOfTransactionsNonce(args.tx.nonce, ...txs)

    // Store known transactions
    await this.database.savePresignedTransaction({ digest, body })

    // Process new config
    await this.saveWalletConfig({ config: args.config })

    // Process all signatures
    return this.processSignatures({ wallet: args.wallet, signatures: args.signatures, digest, imageHash: args.tx.newImageHash })
  }

  processSignatures = async (args: {
    wallet: string,
    digest: string,
    signatures: {
      chainId: BigNumber,
      signature: string
    }[],
    imageHash?: string
  }): Promise<any> => {
    // All recovered configs are probably the same thing
    // so we keep track of the ones we saved to avoid doing it twice
    const savedConfigs = new Set()

    // Process all signatures
    return Promise.all(args.signatures.map(async (s, i) => {
      const subDigest = subDigestOf(args.wallet, s.chainId, args.digest)
      const decoded = decodeSignature(s.signature)
      const recovered = staticRecoverConfig(subDigest, decoded, s.chainId, this.walletConfigs)

      // Save the embeded config
      await Promise.all(recovered.allConfigs.map(async (config) => {
        const ih = imageHash(config)
        if (!savedConfigs.has(ih)) {
          savedConfigs.add(ih)
          await this.database.saveWalletConfig({ config, imageHash: ih })
        }
      }))

      // Save signature parts
      await this.database.saveSignatureParts({
        wallet: args.wallet,
        digest: args.digest,
        chainId: s.chainId,
        imageHash: args.imageHash,
        signatures: recovered.parts.filter((p) => p.signature).map((p) => ({
          part: p.signature!,
          signer: p.signer
        }))
      })
    }))
  }


  loadPresignedConfiguration = async (args: {
    wallet: string,
    fromImageHash: string,
    chainId: BigNumberish,
    prependUpdate: string[],
    longestPath?: boolean,
    gapNonce?: ethers.BigNumberish
  }): Promise<PresignedConfigUpdate[]> => {
    // Create new searcher
    const searcher = new Searcher(this.database, this, args.wallet, ethers.BigNumber.from(args.chainId), true, this.walletConfigs)

    // Get best config jump
    const gapNonce = args.gapNonce ? ethers.BigNumber.from(args.gapNonce) : ethers.constants.Zero
    const configJump = await searcher.bestRouteFrom(args.fromImageHash, gapNonce, args.prependUpdate, args.longestPath)

    // If no result, just return empty array
    if (!configJump) return []

    // Convert config jump to transactions
    const txs: PresignedConfigUpdate[] = []
  
    for (let jump: ConfigJump | undefined = configJump; jump; jump = jump.parent) {
      txs.push({
        body: jump.transaction.body,
        signature: encodeSignature(jump.transaction.signature),
        chainId: ethers.BigNumber.from(args.chainId)
      })
    }
  
    // Reverse the array
    return txs.reverse()
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<{ wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[]> => {
    // Find signature parts for this signer
    const parts = await this.database.getSignaturePartsForAddress({signer: args.signer })

    // Find the wallet for each part
    const txsAndProofs: { wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[] = []

    // Filter duplicates
    // notice: if this is too expensive we can add it to the db
    const seen: { [key: string]: boolean } = {}

    await Promise.all(parts.map(async (p) => {
      if (seen[p.wallet]) {
        return
      }
      seen[p.wallet] = true

      txsAndProofs.push({
        wallet: p.wallet,
        proof: {
          digest: p.digest,
          chainId: p.chainId,
          signature: p.signature,
        }
      })
    }))

    return txsAndProofs
  }

  signaturesOfSigner = async (args: { signer: string }): Promise<{ signature: string, chainid: ethers.BigNumber, wallet: string, digest: string }[]> => {
    const res = await this.database.getSignaturePartsForAddress({ signer: args.signer })
    return res.map((p) => ({
      signature: encodeSignaturePart(p.signature),
      chainid: p.chainId,
      digest: p.digest,
      wallet: p.wallet
    }))
  }

  saveWitness = async( args : {
    wallet: string,
    digest: string,
    signatures: {
      chainId: BigNumberish,
      signature: string
    }[]
  }): Promise<void> => {
    // No need to store digests because these
    // are never used, we just need to store the signature parts

    // Process (validate and store) signatures
    return this.processSignatures({ signatures: args.signatures.map((s) => ({ ...s, chainId: ethers.BigNumber.from(s.chainId)})), wallet: args.wallet, digest: args.digest })
  }

  imageHashesOfSigner = async (args: { signer: string }): Promise<string[]> => {
    return this.database.imageHashesOfSigner({ signer: args.signer })
  }

  signaturesForImageHash = async (args: {
    imageHash: string
  }): Promise<{ signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]> => {
    const res = await this.database.getSignaturePartsForImageHash({ imageHash: args.imageHash })
    return res.map((p) => ({
      signer: p.signer,
      signature: encodeSignaturePart(p.signature),
      chainId: p.chainId,
      digest: p.digest,
      wallet: p.wallet
    }))
  }

  isExportable = () => true

  export = async (): Promise<ExporteConfigTrackerData> => {
    const configs = await this.database.allConfigs()
    const counterFactuals = await this.database.allCounterFactualWallets()
    const rawTransactions = await this.database.allTransactions()
    const signatures = await this.database.allSignatures()

    // Group wallet contexts
    const contexts: WalletContext[] = []
    const contextToIndex = new Map<string, number>()
    const wallets = counterFactuals.map((w) => {
      const key = `${w.context.factory}${w.context.mainModule}`
      if (!contextToIndex.has(key)) {
        const index = contexts.length
        contexts.push(w.context)
        contextToIndex.set(key, index)
      }
      return {
        imageHash: w.imageHash,
        context: contextToIndex.get(key)!
      }
    })

    // Group transactions
    // for this we take every transaction and we append
    // all signatures for it

    // first we need to map digest -> signature
    const digestToSignature = new Map<string, SignaturePart[]>()
    for (const s of signatures) {
      if (!digestToSignature.has(s.digest)) {
        digestToSignature.set(s.digest, [])
      }
      digestToSignature.get(s.digest)!.push(s)
    }

    // map all imageHashes to their configs
    const imageHashToConfig = new Map<string, WalletConfig>()
    for (const c of configs) {
      // TODO: Return imageHash directly for performance reasons
      imageHashToConfig.set(imageHash(c), c)
    }

    // Mark used digest
    // not used signatures should become witnesses
    const usedDigests = new Set<string>()
    const transactions: {
      wallet: string,
      config: WalletConfig,
      tx: {
        wallet: string,
        tx: string,
        newImageHash: string,
        gapNonce: string,
        nonce: string,
        update?: string
      },
      signatures: {
        chainId: string,
        signature: string
      }[]
    }[] = rawTransactions.map((tx) => {
      const signatures = digestToSignature.get(tx.digest) || []
      usedDigests.add(tx.digest)
      const config = imageHashToConfig.get(tx.newImageHash)
      if (!config) {
        throw new Error(`Could not find config for image hash ${tx.newImageHash}`)
      }
      return {
        wallet: tx.wallet,
        config: imageHashToConfig.get(tx.newImageHash)!,
        tx: {
          wallet: tx.wallet,
          tx: tx.tx,
          newImageHash: tx.newImageHash,
          gapNonce: tx.gapNonce.toString(),
          nonce: tx.nonce.toString(),
          update: tx.update
        },
        signatures: signatures.map((s) => ({
          signature: encodeSignaturePart(s.signature),
          chainId: s.chainId.toString(),
        }))
      }
    })

    // Convert unused signatures into witnesses
    const witnesses: {
      wallet: string,
      digest: string,
      signatures: {
        chainId: string,
        signature: string
      }[]
    }[] = []

    for (const [digest, signatureParts] of digestToSignature) {
      if (usedDigests.has(digest) || signatureParts.length === 0) {
        continue
      }
      witnesses.push({
        wallet: signatureParts[0].wallet,
        digest,
        signatures: signatureParts.map((s) => ({
          signature: encodeSignature({
            threshold: 1,
            signers: [s.signature]
          }),
          chainId: s.chainId.toString(),
        }))
      })
    }

    return {
      version: 1,
      contexts,
      configs,
      wallets,
      transactions,
      witnesses
    }
  }

  import = async (data: ExporteConfigTrackerData): Promise<void> => {
    const { contexts: indexToContext, configs, wallets, transactions, witnesses } = data

    // Import all configs
    for (const config of configs) {
      await this.saveWalletConfig({ config })
    }

    // Import all wallets
    for (const wallet of wallets) {
      await this.saveCounterFactualWallet({ imageHash: wallet.imageHash, context: indexToContext[wallet.context] })
    }

    // Import all transactions
    for (const tx of transactions) {
      await this.savePresignedConfiguration({
        wallet: tx.wallet,
        config: tx.config,
        tx: {
          wallet: tx.tx.wallet,
          tx: tx.tx.tx,
          newImageHash: tx.tx.newImageHash,
          gapNonce: ethers.BigNumber.from(tx.tx.gapNonce),
          nonce: ethers.BigNumber.from(tx.tx.nonce),
          update: tx.tx.update
        },
        signatures: tx.signatures.map((s) => ({
          signature: s.signature,
          chainId: ethers.BigNumber.from(s.chainId)
        }))
      })
    }

    // Import all witnesses
    for (const witness of witnesses) {
      await this.saveWitness({
        wallet: witness.wallet,
        digest: witness.digest,
        signatures: witness.signatures.map((s) => ({
          signature: s.signature,
          chainId: ethers.BigNumber.from(s.chainId)
        }))
      })
    }
  }
}

type ConfigJump = {
  transaction: {
    body: TransactionBody,
    signature: DecodedSignature
  },
  parent?: ConfigJump
}

function isConfigJump(cand: any): cand is ConfigJump {
  return (
    typeof cand === 'object' &&
    typeof cand.transaction === 'object' &&
    typeof cand.transaction.body === 'object' &&
    typeof cand.transaction.signature === 'object'
  )
}
