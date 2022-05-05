import { sequenceContext, WalletContext } from "@0xsequence/network"
import { digestOfTransactionsNonce, encodeNonce, readSequenceNonce, unpackMetaTransactionData } from "@0xsequence/transactions"
import { subDigestOf } from "@0xsequence/utils"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { ConfigTrackerDatabase } from "."
import { ConfigTracker, MemoryConfigTrackerDb, SESSIONS_SPACE } from ".."
import { addressOf, DecodedSignature, DecodedSignaturePart, decodeSignature, encodeSignature, encodeSignaturePart, imageHash, staticRecoverConfig } from "../.."
import { WalletConfig } from "../../config"
import { AssumedWalletConfigs, PresignedConfigUpdate, TransactionBody } from "../config-tracker"
import { getUpdateImplementation, isValidWalletUpdate } from "../utils"
import { Searcher } from "./searcher"


export class LocalConfigTracker implements ConfigTracker {
  constructor(
    private database: ConfigTrackerDatabase = new MemoryConfigTrackerDb(),
    public context: WalletContext = sequenceContext,
    public walletConfigs: AssumedWalletConfigs = {}
  ) {}

  saveWalletConfig = async (args: {
    config: WalletConfig
  }): Promise<void> => {
    return this.database.saveWalletConfig({ ...args, imageHash: imageHash(args.config) })
  }

  configOfImageHash = async (args: { imageHash: string; }): Promise<WalletConfig | undefined> => {
    return this.database.configOfImageHash(args)
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
    wallet: string
    fromImageHash: string
    chainId: BigNumberish
    prependUpdate: string[]
  }): Promise<PresignedConfigUpdate[]> => {
    // Create new searcher
    const searcher = new Searcher(this.database, this, args.wallet, ethers.BigNumber.from(args.chainId), true, this.walletConfigs)

    // Get best config jump
    const configJump = await searcher.bestRouteFrom(args.fromImageHash, 0, args.prependUpdate)

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
