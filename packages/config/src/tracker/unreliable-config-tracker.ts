import { WalletContext } from "@0xsequence/network"
import { BigNumberish, BigNumber, ethers } from "ethers"
import { ConfigTracker } from "."
import { imageHash, WalletConfig } from "../config"
import { DecodedSignaturePart } from "../signature"
import { AssumedWalletConfigs, PresignedConfigUpdate, PresignedConfigurationPayload } from "./config-tracker"

export class UnreliableConfigTracker implements ConfigTracker {
  constructor (
    public tracker: ConfigTracker,
    public verbose?: boolean,
    public name?: string,
  ) { }

  private logError(e: any) {
    if (this.verbose) {
      console.warn(`${this.name || "UnreliableConfigTracker"} ${name} error: ${e.message ?? e}`)
    }
  }

  private tryExecuteMethod = async <T, Y>(name: string, method: ((args: Y) => Promise<T>), args: Y, fallback: T): Promise<T> => {
    return new Promise((resolve) => {
      try {
        method(args).then((result) => {
          resolve(result || fallback)
        }).catch((e) => {
          this.logError(e)
          resolve(fallback)
        })
      } catch (e) {
        this.logError(e)
        resolve(fallback)
      }
    })
  }

  loadPresignedConfiguration = async (args: {
    wallet: string,
    fromImageHash: string,
    chainId: BigNumberish,
    prependUpdate: string[],
    assumedConfigs?: AssumedWalletConfigs,
    longestPath?: boolean,
    gapNonce?: BigNumberish
  }): Promise<PresignedConfigUpdate[]> => {
    return this.tryExecuteMethod("loadPresignedConfiguration", this.tracker.loadPresignedConfiguration, args, [])
  }

  savePresignedConfiguration = async (args: PresignedConfigurationPayload): Promise<void> => {
    return this.tryExecuteMethod("savePresignedConfiguration", this.tracker.savePresignedConfiguration, args, undefined)
  }

  configOfImageHash = async (args: { imageHash: string; }): Promise<WalletConfig | undefined> => {
    return this.tryExecuteMethod("configOfImageHash", this.tracker.configOfImageHash, args, undefined)
  }

  saveWalletConfig = async (args: { config: WalletConfig; }): Promise<void> => {
    return this.tryExecuteMethod("saveWalletConfig", this.tracker.saveWalletConfig, args, undefined)
  }

  imageHashOfCounterFactualWallet = async (args: { context: WalletContext; wallet: string; }): Promise<string | undefined> => {
    return this.tryExecuteMethod("imageHashOfCounterFactualWallet", this.tracker.imageHashOfCounterFactualWallet, args, undefined)
  }

  saveCounterFactualWallet = async (args: { imageHash: string; context: WalletContext; }): Promise<void> => {
    return this.tryExecuteMethod("saveCounterFactualWallet", this.tracker.saveCounterFactualWallet, args, undefined)
  }

  saveWitness = async (args: { wallet: string, digest: string, signatures: { chainId: BigNumberish, signature: string }[] }): Promise<void> => {
    return this.tryExecuteMethod("saveWitness", this.tracker.saveWitness, args, undefined)
  }

  walletsOfSigner = async (args: { signer: string; }): Promise<{ wallet: string; proof: { digest: string; chainId: BigNumber; signature: DecodedSignaturePart; }; }[]> => {
    return this.tryExecuteMethod("walletsOfSigner", this.tracker.walletsOfSigner, args, [])
  }

  signaturesOfSigner = async (args: { signer: string }): Promise<{ signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]> => {
    return this.tryExecuteMethod("signaturesOfSigner", this.tracker.signaturesOfSigner, args, [])
  }

  imageHashesOfSigner = async (args: { signer: string }): Promise<string[]> => {
    return this.tryExecuteMethod("imageHashesOfSigner", this.tracker.imageHashesOfSigner, args, [])
  }

  signaturesForImageHash = async (args: { imageHash: string }): Promise<{ signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]> => {
    return this.tryExecuteMethod("signaturesForImageHash", this.tracker.signaturesForImageHash, args, [])
  }
}
