import { WalletContext } from "@0xsequence/network"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { WalletConfig } from "../config"
import { PromiseSome } from "../utils"
import { ConfigTracker, PresignedConfigUpdate, TransactionBody } from "./config-tracker"

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

    // TODO feed all responses to each other child
    // this helps childs be kept in sync with each other
  
    // Find the response with the highest gapNonce
    return responses.reduce((p, c) => {
      // Get last gapNonce of previous eval
      const pgn = p[p.length - 1].body.gapNonce
      // Get last gapNonce of current eval
      const cgn = c[c.length - 1].body.gapNonce

      // Compare gapNonces
      return pgn.gt(cgn) ? p : c
    }, [] as PresignedConfigUpdate[])
  }

  configOfImageHash = async ( args : {
    imageHash: string
  }): Promise<WalletConfig | undefined> => {
    // Query all childs at the same time
    // find a promise that doesn't throw and doesn't return undefined
    const found = await PromiseSome(this.childs.map((c) => c.configOfImageHash(args)))

    // Backfeed found config to all child
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
}
