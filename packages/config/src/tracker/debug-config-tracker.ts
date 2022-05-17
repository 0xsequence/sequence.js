import { WalletContext } from "@0xsequence/network"
import { BigNumber, BigNumberish } from "ethers"
import { ConfigTracker } from "."
import { DecodedSignaturePart, WalletConfig } from ".."
import { AssumedWalletConfigs, PresignedConfigUpdate, PresignedConfigurationPayload } from "./config-tracker"

export class DebugConfigTracker implements ConfigTracker {
  public requests = 0

  constructor (
    public tracker: ConfigTracker
  ) { }

  _getRequest() {
    return this.requests++
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
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] loadPresignedConfiguration(${args.wallet}, ${args.fromImageHash}, ${args.chainId})`)
    const result = await this.tracker.loadPresignedConfiguration(args)
    console.log(`[${id}] loadPresignedConfiguration(${args.wallet}, ${args.fromImageHash}, ${args.chainId}) in ${Date.now() - start}ms => ${JSON.stringify(result)}`)
    return result
  }

  savePresignedConfiguration = async (args: PresignedConfigurationPayload): Promise<void> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] savePresignedConfiguration(${JSON.stringify(args)})`)
    const res = await this.tracker.savePresignedConfiguration(args)
    console.log(`[config-tracker ${id}] savePresignedConfiguration(${JSON.stringify(args)}) in ${Date.now() - start}ms => ${JSON.stringify(res)}`)
    return res
  }

  configOfImageHash = async (args: { imageHash: string; }): Promise<WalletConfig | undefined> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] configOfImageHash(${args.imageHash})`)
    const result = await this.tracker.configOfImageHash(args)
    console.log(`[config-tracker ${id}] configOfImageHash(${args.imageHash}) in ${Date.now() - start}ms => ${JSON.stringify(result)}`)
    return result
  }

  saveWalletConfig = async (args: { config: WalletConfig; }): Promise<void> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] saveWalletConfig(${JSON.stringify(args)})`)
    const res = await this.tracker.saveWalletConfig(args)
    console.log(`[config-tracker ${id}] saveWalletConfig(${JSON.stringify(args)}) in ${Date.now() - start}ms => ${JSON.stringify(res)}`)
    return res
  }

  imageHashOfCounterFactualWallet = async (args: { context: WalletContext; wallet: string; }): Promise<string | undefined> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] imageHashOfCounterFactualWallet(${args.wallet}, ${JSON.stringify(args.context)})`)
    const result = await this.tracker.imageHashOfCounterFactualWallet(args)
    console.log(`[config-tracker ${id}] imageHashOfCounterFactualWallet(${args.wallet}, ${JSON.stringify(args.context)}) in ${Date.now() - start}ms => ${JSON.stringify(result)}`)
    return result
  }

  saveCounterFactualWallet = async (args: { imageHash: string; context: WalletContext; }): Promise<void> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] saveCounterFactualWallet(${args.imageHash}, ${JSON.stringify(args.context)})`)
    const res = await this.tracker.saveCounterFactualWallet(args)
    console.log(`[config-tracker ${id}] saveCounterFactualWallet(${args.imageHash}, ${JSON.stringify(args.context)}) in ${Date.now() - start}ms => ${JSON.stringify(res)}`)
    return res
  }

  walletsOfSigner = async (args: { signer: string; }): Promise<{ wallet: string; proof: { digest: string; chainId: BigNumber; signature: DecodedSignaturePart; }; }[]> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] walletsOfSigner(${args.signer})`)
    const result = await this.tracker.walletsOfSigner(args)
    console.log(`[config-tracker ${id}] walletsOfSigner(${args.signer}) in ${Date.now() - start}ms => ${JSON.stringify(result)}`)
    return result
  }

  signaturesOfSigner = async (args: { signer: string }): Promise<{ signature: string, chainId: BigNumber, wallet: string, digest: string }[]> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] signaturesOfSigner(${args.signer})`)
    const result = await this.tracker.signaturesOfSigner(args)
    console.log(`[config-tracker ${id}] signaturesOfSigner(${args.signer}) in ${Date.now() - start}ms => ${JSON.stringify(result)}`)
    return result
  }

  saveWitness = async (args: { wallet: string, digest: string, signatures: { chainId: BigNumberish, signature: string }[] }): Promise<void> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] saveWitness(${args.wallet}, ${args.digest}, ${JSON.stringify(args.signatures)})`)
    const res = await this.tracker.saveWitness(args)
    console.log(`[config-tracker ${id}] saveWitness(${args.wallet}, ${args.digest}, ${JSON.stringify(args.signatures)}) in ${Date.now() - start}ms => ${JSON.stringify(res)}`)
    return res
  }

  imageHashesOfSigner = async (args: { signer: string }): Promise<string[]> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] imageHashesOfSigner(${args.signer})`)
    const result = await this.tracker.imageHashesOfSigner(args)
    console.log(`[config-tracker ${id}] imageHashesOfSigner(${args.signer}) in ${Date.now() - start}ms => ${JSON.stringify(result)}`)
    return result
  }

  signaturesForImageHash = async (args: {imageHash: string}): Promise<{ signer: string, signature: string, chainId: BigNumber, wallet: string, digest: string }[]> => {
    const id = this._getRequest()
    const start = Date.now()
    console.log(`[config-tracker ${id}] signaturesForImageHash(${args.imageHash})`)
    const result = await this.tracker.signaturesForImageHash(args)
    console.log(`[config-tracker ${id}] signaturesForImageHash(${args.imageHash}) in ${Date.now() - start}ms => ${JSON.stringify(result)}`)
    return result
  }
}
