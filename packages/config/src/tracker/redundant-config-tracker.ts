import { WalletContext } from "@0xsequence/network"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { DecodedSignaturePart } from ".."
import { isAddrEqual, WalletConfig } from "../config"
import { PromiseSome } from "../utils"
import { asPresignedConfigurationAsPayload, ConfigTracker, PresignedConfigUpdate, TransactionBody } from "./config-tracker"

export class RedundantConfigTracker implements ConfigTracker {
  public childs: ConfigTracker[]

  constructor(childs: ConfigTracker[]) {
    this.childs = childs
  }

  loadPresignedConfiguration = async ( args: {
    wallet: string,
    chainId: BigNumberish,
    fromImageHash: string
  }): Promise<PresignedConfigUpdate[]> => {
    // Get all presigned configurations for all childs
    const rawResponses = await Promise.allSettled(this.childs.map((c) => c.loadPresignedConfiguration(args)))

    // Filter empty responses or rejected promises
    const responses = rawResponses
      .filter((r) => r.status === "fulfilled" && r.value?.length > 0)
      .map((r: PromiseFulfilledResult<PresignedConfigUpdate[]>) => r.value)

    // Find the response with the highest gapNonce
    const found = responses.reduce((p, c) => {
      if(c.length === 0) return p
      if(p.length === 0) return c

      // Get last gapNonce of previous eval
      const pgn = p[p.length - 1].body.gapNonce
      // Get last gapNonce of current eval
      const cgn = c[c.length - 1].body.gapNonce

      // Compare gapNonces
      return pgn.gt(cgn) ? p : c
    }, [] as PresignedConfigUpdate[])

    // Convert response back to presigned configuration payload
    // and feed that back to other providers, use a new promise
    // to avoid blocking the other responses
    new Promise(() => {
      // TODO: filter providers
      // who initially responded with the same data
      found.map(async (r) => {
        try {
          const config = await this.configOfImageHash({ imageHash: r.body.newImageHash })
          if (!config) return

          const payload = asPresignedConfigurationAsPayload(r, config)
          this.savePresignedConfiguration(payload)
        } catch {}
      })
    })
  
    return found
  }

  configOfImageHash = async ( args : {
    imageHash: string
  }): Promise<WalletConfig | undefined> => {
    // Query all childs at the same time
    // find a promise that doesn't throw and doesn't return undefined
    const found = await PromiseSome(this.childs.map((c) => c.configOfImageHash(args)))

    // Backfeed found config to all childs
    // TODO: filter equal responses
    if (found !== undefined) {
      this.saveWalletConfig({ config: found })
    }

    // Return found value
    return found
  }

  savePresignedConfiguration = async ( args: {
    wallet: string,
    config: WalletConfig,
    tx: TransactionBody,
    signatures: {
      chainId: BigNumber,
      signature: string
    }[]
  }): Promise<void> => {
    // Save config to all childs
    await Promise.allSettled(this.childs.map((c) => c.savePresignedConfiguration(args)))
  }

  saveWalletConfig = async ( args: {
    config: WalletConfig
  }): Promise<void> => {
    // Save config to all childs
    await Promise.allSettled(this.childs.map((c) => c.saveWalletConfig(args)))
  }

  saveWitness = async( args : {
    wallet: string,
    digest: string,
    signatures: {
      chainId: BigNumberish,
      signature: string
    }[]
  }): Promise<void> => {
    // Save config to all childs
    await Promise.allSettled(this.childs.map((c) => c.saveWitness(args)))
  }

  imageHashOfCounterFactualWallet = async (args: {
    wallet: string,
    context: WalletContext
  }): Promise<string | undefined> => {
    // Query all childs at the same time
    // find a promise that doesn't throw and doesn't return undefined
    const found = await PromiseSome(this.childs.map((c) => c.imageHashOfCounterFactualWallet(args)))

    // Backfeed found config to all other childs
    if (found) {
      this.saveCounterFactualWallet({ imageHash: found, context: args.context })
    }

    // Return found value
    return found
  }

  saveCounterFactualWallet = async (args: { imageHash: string; context: WalletContext }): Promise<void> => {
    // Save config to all childs
    await Promise.allSettled(this.childs.map((c) => c.saveCounterFactualWallet(args)))
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<{ wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[]> => {
    const found = await Promise.allSettled(this.childs.map((c) => c.walletsOfSigner(args)))

    // Combine all found values
    const res: { wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart } }[] = []
    found.forEach((f) => {
      if (f.status === "fulfilled" && f.value) {
        f.value.forEach((v) => {
          if (res.findIndex((c) => c.wallet === v.wallet) === -1) {
            res.push(v)
          }
        })
      }
    })

    return res
  }

  signaturesOfSigner = async (args: {
    signer: string
  }): Promise<{ signature: string, chainid: ethers.BigNumber, wallet: string, digest: string }[]> => {
    // Call signatures of signer on all childs
    const res = await Promise.allSettled(this.childs.map((c) => c.signaturesOfSigner(args)))

    // Aggregate all results and filter duplicated digests
    return res.reduce((p, c) => {
      if (c.status === "fulfilled" && c.value) {
        c.value.forEach((v) => {
          if (p.findIndex((c) => c.digest === v.digest) === -1) {
            p.push(v)
          }
        })
      }

      return p
    }, [] as { signature: string, chainid: ethers.BigNumber, wallet: string, digest: string }[])
  }

  imageHashesOfSigner = async (args: { signer: string }): Promise<string[]> => {
    // Call image hashes of signer on all childs
    const res = await Promise.allSettled(this.childs.map((c) => c.imageHashesOfSigner(args)))

    // Aggregate all results
    return res.reduce((p, c) => {
      if (c.status === "fulfilled" && c.value) {
        c.value.forEach((v) => {
          if (p.findIndex((c) => c === v) === -1) {
            p.push(v)
          }
        })
      }

      return p
    }, [] as string[])
  }

  signaturesForImageHash = async (args: {
    imageHash: string
  }): Promise<{ signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]> => {
    // Call signatures of signer on all childs
    const res = await Promise.allSettled(this.childs.map((c) => c.signaturesForImageHash(args)))

    // Aggregate all results and filter duplicated digests
    return res.reduce((p, c) => {
      if (c.status === "fulfilled" && c.value) {
        c.value.forEach((v) => {
          if (p.findIndex((c) => c.digest === v.digest && isAddrEqual(c.wallet, v.wallet)) === -1) {
            p.push(v)
          }
        })
      }

      return p
    }, [] as { signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[])
  }
}
