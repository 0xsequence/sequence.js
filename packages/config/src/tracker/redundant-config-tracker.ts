import { WalletContext } from "@0xsequence/network"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { DecodedSignaturePart } from ".."
import { isAddrEqual, WalletConfig } from "../config"
import { asPresignedConfigurationAsPayload, AssumedWalletConfigs, ConfigTracker, PresignedConfigUpdate, TransactionBody } from "./config-tracker"

export class RedundantConfigTracker implements ConfigTracker {
  public childs: ConfigTracker[]

  constructor(childs: ConfigTracker[]) {
    this.childs = childs
  }

  loadPresignedConfiguration = async ( args: {
    wallet: string,
    fromImageHash: string,
    chainId: BigNumberish,
    prependUpdate: string[],
    assumedConfigs?: AssumedWalletConfigs,
    longestPath?: boolean,
    gapNonce?: BigNumberish
  }): Promise<PresignedConfigUpdate[]> => {
    // Track which child returned each result
    // so we don't backfeed the same result to them
    const provided: { [key: string]: number[] } = {}
    const keyOf = (update: PresignedConfigUpdate[]): string => {
      if (update.length === 0) return ""
      return update.length + "-" + update[update.length-1].body.newImageHash
    } 

    // Get all presigned configurations for all childs
    const responses = await Promise.all(this.childs.map(async (c, i) => {
      const res = await c.loadPresignedConfiguration(args)
      const key = keyOf(res)
      if (!provided[key]) {
        provided[key] = [i]
      } else {
        provided[key].push(i)
      }

      return res
    }))

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
    const skipIndexes = provided[keyOf(found)]
    new Promise(() => {
      found.map(async (r) => {
        try {
          const config = await this.configOfImageHash({ imageHash: r.body.newImageHash })
          if (!config) return

          const payload = asPresignedConfigurationAsPayload(r, config)
          this.savePresignedConfiguration({ ...payload, skipIndexes })
        } catch {}
      })
    })
  
    return found
  }

  configOfImageHash = async ( args : {
    imageHash: string
  }): Promise<WalletConfig | undefined> => {
    // Execute in childs one by one until we found something
    for (let i = 0; i < this.childs.length; i++) {
      const config = await this.childs[i].configOfImageHash(args)
      if (config) {
        // Backfeed to other childs, but not to self
        this.saveWalletConfig({ config, skipIndexes: [i] })
        return config
      }
    }

    return undefined
  }

  savePresignedConfiguration = async ( args: {
    wallet: string,
    config: WalletConfig,
    tx: TransactionBody,
    signatures: {
      chainId: BigNumber,
      signature: string
    }[],
    skipIndexes?: number[]
  }): Promise<void> => {
    // Save config to all childs
    await Promise.all(this.childs.map((c, i) => {
      if (args.skipIndexes?.includes(i)) return
      return c.savePresignedConfiguration(args)
    }))
  }

  saveWalletConfig = async ( args: {
    config: WalletConfig,
    skipIndexes?: number[]
  }): Promise<void> => {
    // Save config to all childs
    await Promise.all(this.childs.map((c, i) => {
      if (args.skipIndexes?.includes(i)) return
      return c.saveWalletConfig(args)
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
    // Save config to all childs
    await Promise.all(this.childs.map((c) => c.saveWitness(args)))
  }

  imageHashOfCounterFactualWallet = async (args: {
    wallet: string,
    context: WalletContext
  }): Promise<string | undefined> => {
    // Execute in childs one by one until we found something
    for (let i = 0; i < this.childs.length; i++) {
      const imageHash = await this.childs[i].imageHashOfCounterFactualWallet(args)
      if (imageHash) {
        // Backfeed to other childs, but not to self
        this.saveCounterFactualWallet({ imageHash, context: args.context, skipIndexes: [i] })
        return imageHash
      }
    }

    return undefined
  }

  saveCounterFactualWallet = async (args: {
    imageHash: string,
    context: WalletContext,
    skipIndexes?: number[]
  }): Promise<void> => {
    // Save config to all childs
    await Promise.all(this.childs.map((c, i) => {
      if (args.skipIndexes?.includes(i)) return
      return c.saveCounterFactualWallet(args)
    }))
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<{ wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[]> => {
    const found = await Promise.all(this.childs.map((c) => c.walletsOfSigner(args)))

    // Combine all found values
    const res: { wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart } }[] = []
    found.forEach((f) => {
      f.forEach((v) => {
        if (res.findIndex((c) => c.wallet === v.wallet) === -1) {
          res.push(v)
        }
      })
    })

    return res
  }

  signaturesOfSigner = async (args: {
    signer: string
  }): Promise<{ signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]> => {
    // Call signatures of signer on all childs
    const res = await Promise.all(this.childs.map((c) => c.signaturesOfSigner(args)))

    // Aggregate all results and filter duplicated digests
    return res.reduce((p, c) => {
      c.forEach((v) => {
        if (p.findIndex((c) => c.digest === v.digest) === -1) {
          p.push(v)
        }
      })

      return p
    }, [] as { signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[])
  }

  imageHashesOfSigner = async (args: { signer: string }): Promise<string[]> => {
    // Call image hashes of signer on all childs
    const res = await Promise.all(this.childs.map((c) => c.imageHashesOfSigner(args)))

    // Aggregate all results
    return res.reduce((p, c) => {
      c.forEach((v) => {
        if (p.findIndex((c) => c === v) === -1) {
          p.push(v)
        }
      })

      return p
    }, [] as string[])
  }

  signaturesForImageHash = async (args: {
    imageHash: string
  }): Promise<{ signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]> => {
    // Call signatures of signer on all childs
    const res = await Promise.all(this.childs.map((c) => c.signaturesForImageHash(args)))

    // Aggregate all results and filter duplicated digests
    return res.reduce((p, c) => {
      c.forEach((v) => {
        if (p.findIndex((c) => c.digest === v.digest && isAddrEqual(c.wallet, v.wallet)) === -1) {
          p.push(v)
        }
      })

      return p
    }, [] as { signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[])
  }
}
