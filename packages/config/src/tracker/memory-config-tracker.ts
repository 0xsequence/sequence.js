import { sequenceContext, WalletContext } from "@0xsequence/network"
import { digestOfTransactionsNonce, encodeNonce, Transaction, unpackMetaTransactionData , packMetaTransactionsData } from "@0xsequence/transactions"
import { subDigestOf } from "@0xsequence/utils"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { ConfigTracker, SESSIONS_SPACE } from "."
import { addressOf, DecodedSignature, DecodedSignaturePart, decodeSignature, encodeSignature, imageHash, isDecodedAddress, isDecodedEOASigner, isDecodedEOASplitSigner, recoverEOASigner } from ".."
import { isAddrEqual, WalletConfig } from "../config"
import { PresignedConfigUpdate, TransactionBody } from "./config-tracker"
import { isValidWalletUpdate } from "./utils"

/**
  * @description MemoryConfigTracker is a ConfigTracker that stores all information in memory.
  * @dev This is useful for testing. Is NOT optimized and is not recommended for production use.
*/
export class MemoryConfigTracker implements ConfigTracker {

  private knownConfigs: WalletConfig[] = []
  private knownImageHashes: { imageHash: string, context: WalletContext }[] = []
  private knownTransactions: { txs: Transaction[], gapNonce: ethers.BigNumber, nonce: ethers.BigNumber, newImageHash: string }[] = []
  private knownSignatureParts: { signer: string, signature: DecodedSignaturePart, digest: string, chainId: ethers.BigNumber }[] = []

  public context: WalletContext

  constructor(context?: WalletContext) {
    this.context = context || sequenceContext
  }

  saveWalletConfig = async (args: {
    config: WalletConfig
  }): Promise<void> => {
    // May store duplicates, doesn't matter
    this.knownConfigs = [...this.knownConfigs, args.config]
  }

  configOfImageHash = async (args: { imageHash: string; }): Promise<WalletConfig | undefined> => {
    return this.knownConfigs.find((c) => imageHash(c) === args.imageHash)
  }

  saveCounterFactualWallet = async (args: {
    imageHash: string
    context: WalletContext
  }): Promise<void> => {
    // This may store, it doesn't matter
    this.knownImageHashes = [...this.knownImageHashes, { imageHash: args.imageHash, context: args.context }]
  }

  imageHashOfCounterFactualWallet = async (args: {
    context: WalletContext
    wallet: string
  }): Promise<string | undefined> => {
    // Find an imageHash that derives to the wallet
    const found = this.knownImageHashes.find((w) => isAddrEqual(addressOf(w.imageHash, w.context), args.wallet))
    return found?.imageHash
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

    // Transaction nonce should be
    // expected session nonce (SessionSpace and zero)
    const expectedNonce = encodeNonce(SESSIONS_SPACE, 0)
    if (!expectedNonce.eq(args.tx.nonce)) {
      throw new Error(`Invalid transaction nonce ${args.tx.nonce.toString()} expected ${expectedNonce.toString()}`)
    }

    // Store known transactions
    this.knownTransactions.push({ txs, nonce: args.tx.nonce, gapNonce: args.tx.gapNonce, newImageHash: args.tx.newImageHash })

    // Get digest of transaction
    const digest = digestOfTransactionsNonce(args.tx.nonce, ...txs)

    // Process all signatures
    args.signatures.forEach((s) => {
      const subDigest = subDigestOf(args.wallet, s.chainId, digest)
      const decoded = decodeSignature(s.signature)

      // Decode the configuration embedded in the signature
      const config: WalletConfig = { threshold: decoded.threshold, signers: [] }

      // Process every part of signature individually
      // because we could mix and match them in the future
      decoded.signers.forEach((p) => {
        // Ignore "address" types
        // just use them to retrieve the embedded config
        if (isDecodedAddress(p)) {
          config.signers.push({ weight: p.weight, address: p.address })
          return
        }

        // If EOA signature just recover it
        if (isDecodedEOASigner(p) || isDecodedEOASplitSigner(p)) {
          const recovered = recoverEOASigner(subDigest, p)
          config.signers.push({ weight: p.weight, address: recovered })
          this.knownSignatureParts.push({
            signer: recovered,
            signature: p,
            digest: digest,
            chainId: s.chainId,
          })
          return
        }

        // TODO: Handle other types, including nested singautres
        throw Error(`Unsupported signature type ${JSON.stringify(p)}`)
      })

      // Save the embeded config
      this.saveWalletConfig({ config })
    })
  }


  loadPresignedConfiguration = async (args: {
    wallet: string
    fromImageHash: string
    chainId: BigNumberish
  }): Promise<PresignedConfigUpdate[]> => {
    // Get best config jump
    const configJump = await this.recursiveFindPath({
      parents: [{ imageHash: args.fromImageHash }],
      wallet: args.wallet,
      chainId: ethers.BigNumber.from(args.chainId),
      minGapNonce: ethers.BigNumber.from(0)
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
  }): Promise<ConfigJump | undefined> => {
    // Prepare list of new candidates
    const newCandidates: ConfigJump[] = []

    // Track best possible candidate
    let bestCandidate = args.bestCandidate

    // Find candidates for every parent
    await Promise.all(args.parents.map(async (parent) => {
      const minGapNonce = isConfigJump(parent) ? parent.transaction.body.gapNonce : args.minGapNonce

      // Find all candidates with this parent and min gap nonce
      const candidates = await this.candidatesForJump({
        fromImageHash: isConfigJump(parent) ? parent.transaction.body.newImageHash : parent.imageHash,
        chainId: args.chainId,
        wallet: args.wallet,
        minGapNonce,
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
  }): Promise<ConfigJump[]> => {
    // Get configuration for current imageHash
    const fromConfig = await this.configOfImageHash({ imageHash: args.fromImageHash })
    if (!fromConfig) throw Error(`No configuration found for imageHash ${args.fromImageHash}`)

    // Track combined weight of all transactions
    // transactions below thershold should be descarded
    const weights = new Map<string, ethers.BigNumber>()

    // Get all known signatures for every signer on the config
    fromConfig.signers.forEach((s) => {
      const signatures = this.knownSignatureParts.filter((p) => p.signer === s.address && p.chainId.eq(args.chainId))
      signatures.forEach((signature) => {
        // Get weight of the signer
        const prevWeight = weights.get(signature.signer) ?? ethers.constants.Zero
        weights.set(signature.digest, prevWeight.add(signature.signature.weight))
      })
    })

    // Build candidates
    const candidates: ConfigJump[] = []

    // Filter out transactions below threshold
    // then build candidates for each one of the remaining transactions
    weights.forEach((weight, digest) => {
      if (weight.lt(fromConfig.threshold)) {
        return
      }

      const tx = this.knownTransactions.find((t) => digestOfTransactionsNonce(t.nonce, ...t.txs) === digest)
      if (!tx) throw Error(`No transaction found for digest ${digest}`)

      // Ignore lower gapNonces
      if (tx.gapNonce.lte(args.minGapNonce)) {
        return
      }

      const signature = fromConfig.signers.map<DecodedSignaturePart>((s) => {
        const part = this.knownSignatureParts.find((p) => p.digest === digest && p.signer === s.address && p.chainId.eq(args.chainId))
        if (!part) {
          return { weight: s.weight, address: s.address }
        }

        // TODO: Handle nested signatures

        const npart = { ...part.signature }
        npart.weight = s.weight
        return npart
      })

      candidates.push({
        transaction: {
          body: {
            wallet: args.wallet,
            tx: packMetaTransactionsData(tx.txs),
            nonce: tx.nonce,
            gapNonce: tx.gapNonce,
            newImageHash: tx.newImageHash
          },
          signature: {
            threshold: fromConfig.threshold,
            signers: signature,
          },
        },
      })
    })

    return candidates
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<{ wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[]> => {
    // Find signature parts for this signer
    const parts = this.knownSignatureParts.filter((p) => isAddrEqual(p.signer, args.signer))

    // Find the wallet for each part
    const txsAndProofs: { wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[] = []

    parts.forEach((p) => {
      const tx = this.knownTransactions.find((t) => digestOfTransactionsNonce(t.nonce, ...t.txs) === p.digest)
      if (!tx || tx.txs.length === 0) return

      const wallet = tx.txs[0].to
      if (txsAndProofs.find((c) => c.wallet === wallet)) return

      txsAndProofs.push({
        wallet,
        proof: {
          digest: p.digest,
          chainId: p.chainId,
          signature: p.signature,
        }
      })
    })

    return txsAndProofs
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
