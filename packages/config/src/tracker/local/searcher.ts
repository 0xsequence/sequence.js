import { ethers } from "ethers"
import { ConfigTrackerDatabase, SignaturePart } from "."
import { DecodedSignature } from "../.."
import { DecodedAddressPart, DecodedEOASigner, DecodedFullSigner, DecodedSignaturePart, encodeSignature, encodeSignaturePart } from "../../signature"
import { AssumedWalletConfigs, ConfigTracker, TransactionBody } from "../config-tracker"

function isConfigJump(cand: any): cand is ConfigJump {
  return (
    typeof cand === 'object' &&
    typeof cand.transaction === 'object' &&
    typeof cand.transaction.body === 'object' &&
    typeof cand.transaction.signature === 'object'
  )
}

type ConfigJump = {
  transaction: {
    body: TransactionBody,
    signature: DecodedSignature
  },
  parent?: ConfigJump
}

export class Searcher {
  public transactionCache: Map<string, TransactionBody> = new Map()
  public signerCache: Map<string, { parts: SignaturePart[], minGapNonce: ethers.BigNumber }> = new Map()

  public imageHashHitmap: Set<String> = new Set()
  public emptySignerHitmap: Set<string> = new Set()

  constructor (
    private db: ConfigTrackerDatabase,
    public tracker: Pick<ConfigTracker, 'configOfImageHash'>,
    public wallet: string,
    public chainId: ethers.BigNumber,
    public useCache: boolean,
    public walletConfigs: AssumedWalletConfigs
  ) {}

  imageHashHitmapKey(imageHash: string, update: string) {
    return imageHash + update
  }

  async transactionForDigest(digest: string): Promise<TransactionBody | undefined> {
    if (!this.useCache) return this.db.transactionWithDigest({ digest })

    if (!this.transactionCache.has(digest)) {
      const res = await this.db.transactionWithDigest({ digest })
      if (!res) return

      this.transactionCache.set(digest, res)
      return res
    }

    return this.transactionCache.get(digest)
  }

  async signaturesOfSigner(signer: string, minGapNonce: ethers.BigNumber): Promise<SignaturePart[]> {
    if (!this.useCache) return this.signaturesOfSignerFromDb(signer)

    if (!this.signerCache.get(signer)) {
      const res = await this.signaturesOfSignerFromDb(signer)

      // TODO Remove this when moved to DB, but filter by min gap nonce
      // const fres = res.filter((r) => minGapNonce.lte(r.))

      this.signerCache.set(signer, {
        minGapNonce,
        parts: res
      })

      return res
    }

    // TODO Filter by minGapNonce
    const res = this.signerCache.get(signer)?.parts
    return res ?? []
  }

  async signaturesOfSignerFromDb(signer: string): Promise<SignaturePart[]> {
    // If no assumed wallet config, signer must be an EOA
    // so just return all known parts for it
    if (!this.walletConfigs[signer]) {
      return this.db.getSignaturePartsForAddress({ signer, chainId: this.chainId })
    }

    // Otherwise, we need to get all parts for each sub-signer
    // and then filter out the ones that don't reach the threshold
    const parts: { [key: string]: SignaturePart[] } = {}
    const weights: { [key: string]: number } = {}

    for (const subSigner of this.walletConfigs[signer].signers) {
      const subParts = await this.signaturesOfSignerFromDb(subSigner.address)
      for (const part of subParts) {
        if (!parts[part.digest]) parts[part.digest] = []
        parts[part.digest].push(part)

        if (!weights[part.digest]) weights[part.digest] = 0
        weights[part.digest] += subSigner.weight
      }
    }

    // Filter out parts that don't reach the threshold
    const res: SignaturePart[] = []
    for (const digest of Object.keys(parts)) {
      if (weights[digest] >= this.walletConfigs[signer].threshold) {
        const digestParts = parts[digest]

        // Map parts to signers
        const signers: { [key: string]: SignaturePart } = {}
        for (const part of digestParts) {
          signers[part.signer] = part
        }

        // Push encoded signatures into res array
        const fp = this.walletConfigs[signer].signers.map((subSigner) => {
          if (!signers[subSigner.address]) return subSigner as DecodedAddressPart
          return { ...signers[subSigner.address].signature, weight: subSigner.weight }
        })

        const encoded = encodeSignature({
          threshold: this.walletConfigs[signer].threshold,
          signers: fp
        }) + '03'

        res.push({
          signer,
          wallet: this.wallet,
          signature: {
            address: signer,
            signature: encoded
          } as DecodedFullSigner,
          digest,
          chainId: this.chainId
        })
      }
    }

    return res
  }

  async bestRouteFrom(imageHash: string, gapNonce: ethers.BigNumberish, prependUpdate: string[], longestPath?: boolean): Promise<ConfigJump | undefined> {
    const res = await this.recursiveFindPath({
      fromImageHash: imageHash,
      minGapNonce: ethers.BigNumber.from(gapNonce),
      prependUpdate,
      longestPath
    })
    return res
  }

  private recursiveFindPath = async (args: {
    fromImageHash?: string,
    minGapNonce: ethers.BigNumber,
    bestCandidate?: ConfigJump,
    prependUpdate?: string[],
    longestPath?: boolean
  }): Promise<ConfigJump | undefined> => {
    if (args.fromImageHash && args.bestCandidate) {
      throw new Error('Cannot specify both fromImageHash and bestCandidate')
    } else if (!args.fromImageHash && !args.bestCandidate) {
      throw new Error('Must specify either fromImageHash or bestCandidate')
    }

    const minGapNonce = !args.bestCandidate ? args.minGapNonce : args.bestCandidate.transaction.body.gapNonce
    const fromImageHash = !args.bestCandidate ? args.fromImageHash : args.bestCandidate.transaction.body.newImageHash
    if (!fromImageHash) throw new Error('fromImageHash expected')

    // Find all candidates with this parent and min gap nonce
    const candidates = await this.candidatesForJump({
      fromImageHash,
      chainId: this.chainId,
      wallet: this.wallet,
      minGapNonce,
      prependUpdate: args.prependUpdate
    })

    // If no candidates, we're done
    if (candidates.length === 0) return args.bestCandidate

    // If we're looking for the longest path, we need to find the longest candidate
    const candidatesWithParent = args.bestCandidate ? candidates.map((c) => ({ ...c, parent: args.bestCandidate })) : candidates
    let bestCandidate = candidatesWithParent[0]

    if (!args.longestPath) {
      for (let i = 0; i < candidatesWithParent.length; i++) {
        const candidate = candidatesWithParent[i]
        if (candidate.transaction.body.gapNonce.gt(bestCandidate.transaction.body.gapNonce)) {
          bestCandidate = candidate
        }
      }
    } else {
      for (let i = 0; i < candidatesWithParent.length; i++) {
        const candidate = candidatesWithParent[i]
        if (candidate.transaction.body.gapNonce.lt(bestCandidate.transaction.body.gapNonce)) {
          bestCandidate = candidate
        }
      }
    }

    // Recurse
    return this.recursiveFindPath({
      minGapNonce: args.minGapNonce,
      bestCandidate,
      longestPath: args.longestPath
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
    const fromConfig = await this.tracker.configOfImageHash({ imageHash: args.fromImageHash })
    if (!fromConfig) {
      console.warn(`No configuration found for imageHash ${args.fromImageHash}`)
      return []
    }

    // Track combined weight of all transactions
    // transactions below thershold should be descarded
    const weights = new Map<string, ethers.BigNumber>()
    const parts = new Map<string, SignaturePart>()

    // Get all known signatures for every signer on the config
    await Promise.all(fromConfig.signers.map(async (s) => {
      const signatures = await this.signaturesOfSigner(s.address, args.minGapNonce)
      signatures.forEach((signature) => {
        // Get weight of the signer
        const prevWeight = weights.get(signature.digest) ?? ethers.constants.Zero
        weights.set(signature.digest, prevWeight.add(s.weight))
        parts.set(`${signature.digest}-${signature.signer}`, signature)
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
      const tx = await this.transactionForDigest(digest)
      if (!tx) {
        return
      }

      // Ignore lower gapNonces
      if (tx.gapNonce.lte(args.minGapNonce)) {
        return
      }

      // Ignore wrong wallets
      if (tx.wallet.toLowerCase() !== args.wallet.toLowerCase()) {
        return
      }

      // If prependUpdate is set, check if the transaction is in the list
      if (args.prependUpdate) {
        if (args.prependUpdate.length === 0) {
          // tx update must be empty
          if (tx.update) {
            return
          }
        } else {
          // tx update must be among prepependUpdate array
          const found = args.prependUpdate.find((update) => tx.update && update === tx.update)
          if (!found) {
            return
          }
        }
      }

      const unsortedSignature = await Promise.all(fromConfig.signers.map(async (s, i) => {
        const part = parts.get(`${digest}-${s.address}`)
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
}
