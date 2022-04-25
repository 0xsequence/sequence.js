import { ethers } from "ethers"
import { ConfigTrackerDatabase, SignaturePart } from "."
import { DecodedSignature } from "../.."
import { ConfigTracker, TransactionBody } from "../config-tracker"

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
    public useCache: boolean
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
    if (!this.useCache) return this.db.getSignaturePartsForAddress({ signer, chainId: this.chainId })

    if (!this.signerCache.get(signer)) {
      const res = await this.db.getSignaturePartsForAddress({ signer, chainId: this.chainId })

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

  async bestRouteFrom(imageHash: string, gapNonce: ethers.BigNumberish, prependUpdate: string[]): Promise<ConfigJump | undefined> {
    const res = await this.recursiveFindPath({
      parents: [{ imageHash }],
      minGapNonce: ethers.BigNumber.from(gapNonce),
      prependUpdate
    })
    return res
  }

  private recursiveFindPath = async (args: {
    parents: ConfigJump[] | { imageHash: string }[],
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
      const fromImageHash = isFirst ? parent.imageHash : parent.transaction.body.newImageHash

      // Prepend update key sufix
      const updateSufix = args.prependUpdate?.join(',') ?? ''

      // Don't eval same imageHash multiple times
      const key = this.imageHashHitmapKey(fromImageHash, updateSufix)
      if (this.imageHashHitmap.has(key)) {
        return
      }

      this.imageHashHitmap.add(key)

      // Find all candidates with this parent and min gap nonce
      const candidates = await this.candidatesForJump({
        fromImageHash,
        chainId: this.chainId,
        wallet: this.wallet,
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

      // Only add highest candidate
      // this will not find the shortest path, but it will
      // reduce the search space considerably.
      if (candidatesWithParents.length > 0) {
        let higher = candidatesWithParents[0]
        for (let i = 0; i < candidatesWithParents.length; i++) {
          const c = candidatesWithParents[i]
          if (c.transaction.body.gapNonce > higher.transaction.body.gapNonce) {
            higher = c
          }
        }

        newCandidates.push(higher)
      }

      // Add parents to candidates
      // NOTICE: Disabled due to performance reasons 
      // newCandidates.push(...candidatesWithParents)
    }))

    // If no more candidates just return best candidate
    if (newCandidates.length === 0) {
      return bestCandidate
    }

    // Recurse
    return this.recursiveFindPath({
      parents: newCandidates,
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
    const fromConfig = await this.tracker.configOfImageHash({ imageHash: args.fromImageHash })
    if (!fromConfig) {
      console.warn(`No configuration found for imageHash ${args.fromImageHash}`)
      return []
    }

    // Track combined weight of all transactions
    // transactions below thershold should be descarded
    const weights = new Map<string, ethers.BigNumber>()

    // Get all known signatures for every signer on the config
    await Promise.all(fromConfig.signers.map(async (s) => {
      const signatures = await this.signaturesOfSigner(s.address, args.minGapNonce)
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
          if (tx.update) return
        } else {
          // tx update must be among prepependUpdate array
          const found = args.prependUpdate.find((update) => tx.update && update === tx.update)
          if (!found) {
            return
          }
        }
      }

      const unsortedSignature = await Promise.all(fromConfig.signers.map(async (s, i) => {
        // TODO: WHAT
        const part = await this.db.getSignaturePart({ signer: s.address, digest, chainId: args.chainId })
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
