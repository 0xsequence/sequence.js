import { sequenceContext, WalletContext } from "@0xsequence/network"
import { digestOfTransactionsNonce, encodeNonce, unpackMetaTransactionData } from "@0xsequence/transactions"
import { subDigestOf } from "@0xsequence/utils"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { ConfigTrackerDatabase } from "."
import { ConfigTracker, MemoryConfigTrackerDb, SESSIONS_SPACE } from ".."
import { addressOf, DecodedSignature, DecodedSignaturePart, decodeSignature, encodeSignature, encodeSignaturePart, imageHash, staticRecoverConfig } from "../.."
import { WalletConfig } from "../../config"
import { AssumedWalletConfigs, PresignedConfigUpdate, TransactionBody } from "../config-tracker"
import { getUpdateImageHashImpl, isUpdateImplementationTx, isValidWalletUpdate } from "../utils"


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
    const updateImpl = getUpdateImageHashImpl(args.wallet, txs[0])
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
    this.processSignatures({ wallet: args.wallet, signatures: args.signatures, digest, imageHash: args.tx.newImageHash })
  }

  processSignatures = async (args: {
    wallet: string,
    digest: string,
    signatures: {
      chainId: BigNumber,
      signature: string
    }[],
    imageHash?: string
  }): Promise<void> => {
    // Process all signatures
    await Promise.all(args.signatures.map(async (s) => {
      const subDigest = subDigestOf(args.wallet, s.chainId, args.digest)
      const recovered = staticRecoverConfig(subDigest, decodeSignature(s.signature), s.chainId.toNumber(), this.walletConfigs)

      // Save the embeded config
      await Promise.all(recovered.allConfigs.map((config) => this.saveWalletConfig({ config })))

      // Save signature parts
      await Promise.all(recovered.parts.map(async (p) => {
        const signature = p.signature
        if (!signature) return

        await this.database.saveSignaturePart({
          wallet: args.wallet,
          signature,
          signer: p.signer,
          digest: args.digest,
          chainId: s.chainId,
          imageHash: args.imageHash
        })
      }))
    }))
  }


  loadPresignedConfiguration = async (args: {
    wallet: string
    fromImageHash: string
    chainId: BigNumberish
    prependUpdate: string[]
  }): Promise<PresignedConfigUpdate[]> => {
    // Get best config jump
    const configJump = await this.recursiveFindPath({
      parents: [{ imageHash: args.fromImageHash }],
      wallet: args.wallet,
      chainId: ethers.BigNumber.from(args.chainId),
      minGapNonce: ethers.BigNumber.from(0),
      prependUpdate: args.prependUpdate
    })

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
  
  private recursiveFindPath = async (args: {
    parents: ConfigJump[] | { imageHash: string }[],
    wallet: string,
    chainId: ethers.BigNumber,
    minGapNonce: ethers.BigNumber,
    bestCandidate?: ConfigJump
    prependUpdate?: string[]
  }): Promise<ConfigJump | undefined> => {
    // Prepare list of new candidates
    const newCandidates: ConfigJump[] = []

    // Track best possible candidate
    let bestCandidate = args.bestCandidate

    // Find candidates for every parent
    await Promise.all(args.parents.map(async (parent) => {
      const isFirst = !isConfigJump(parent)
      const minGapNonce = isFirst ? args.minGapNonce : parent.transaction.body.gapNonce

      // Find all candidates with this parent and min gap nonce
      const candidates = await this.candidatesForJump({
        fromImageHash: isFirst ? parent.imageHash : parent.transaction.body.newImageHash,
        chainId: args.chainId,
        wallet: args.wallet,
        minGapNonce,
        prependUpdate: args.prependUpdate
      })

      // Compare each with best candidate and find the best one
      const candidatesWithParents = isConfigJump(parent) ? candidates.map((c) => ({ ...c, parent })) : candidates
      candidatesWithParents.forEach((candidate) => {
        if (!bestCandidate) {
          bestCandidate = candidate
        } else {
          const bgp = bestCandidate.transaction?.body.gapNonce
          const cgp = candidate.transaction?.body.gapNonce
          if (bgp && cgp && cgp.gt(bgp)) {
            bestCandidate = candidate
          }
        }
      })

      // Add parents to candidates
      newCandidates.push(...candidatesWithParents)
    }))

    // If no more candidates just return best candidate
    if (newCandidates.length === 0) {
      return bestCandidate
    }

    // Recurse
    return this.recursiveFindPath({
      parents: newCandidates,
      wallet: args.wallet,
      chainId: args.chainId,
      minGapNonce: args.minGapNonce,
      bestCandidate,
    })
  }

  private candidatesForJump = async (args: {
    fromImageHash: string,
    wallet: string,
    chainId: ethers.BigNumber,
    minGapNonce: ethers.BigNumber,
    prependUpdate?: string[]
  }): Promise<ConfigJump[]> => {
    // Get configuration for current imageHash
    const fromConfig = await this.configOfImageHash({ imageHash: args.fromImageHash })
    if (!fromConfig) throw Error(`No configuration found for imageHash ${args.fromImageHash}`)

    // Track combined weight of all transactions
    // transactions below thershold should be descarded
    const weights = new Map<string, ethers.BigNumber>()

    // Get all known signatures for every signer on the config
    await Promise.all(fromConfig.signers.map(async (s) => {
      const signatures = await this.database.getSignaturePartsForAddress({ signer: s.address, chainId: args.chainId })
      signatures.forEach((signature) => {
        // Get weight of the signer
        const prevWeight = weights.get(signature.digest) ?? ethers.constants.Zero
        weights.set(signature.digest, prevWeight.add(signature.signature.weight))
      })
    }))

    // Build candidates
    const candidates: ConfigJump[] = []

    // Filter out transactions below threshold
    // then build candidates for each one of the remaining transactions
    await Promise.all(Array.from(weights).map(async (val) => {
      const [digest, weight] = val

      if (weight.lt(fromConfig.threshold)) {
        return
      }

      // No transaction found for diggest
      // probably it was created with a witness
      const tx = await this.database.transactionWithDigest({ digest })
      if (!tx) return

      // Ignore lower gapNonces
      if (tx.gapNonce.lte(args.minGapNonce)) {
        return
      }

      // If prependUpdate is set, check if the transaction is in the list
      if (args.prependUpdate) {
        const found = args.prependUpdate.find((update) => tx.update && update === tx.update)
        if (!found) return
      }

      const unsortedSignature = await Promise.all(fromConfig.signers.map(async (s, i) => {
        const part = await this.database.getSignaturePart({ signer: s.address, digest, chainId: args.chainId })
        if (!part) {
          return { weight: s.weight, address: s.address, i }
        }

        const npart = { ...part.signature, i }
        npart.weight = s.weight
        return npart
      }))

      // Promise may return signatures in any order
      // so sort them using i and then filter i out
      const signature = unsortedSignature
        .sort((a, b) => a.i - b.i)
        .map((s) => ({ ...s, i: undefined }))

      candidates.push({
        transaction: {
          body: tx,
          signature: {
            threshold: fromConfig.threshold,
            signers: signature,
          },
        },
      })
    }))

    return candidates
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<{ wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[]> => {
    // Find signature parts for this signer
    const parts = await this.database.getSignaturePartsForAddress({signer: args.signer })

    // Find the wallet for each part
    const txsAndProofs: { wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[] = []

    await Promise.all(parts.map(async (p) => {
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
