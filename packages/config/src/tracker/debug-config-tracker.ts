import { WalletContext } from "@0xsequence/network"
import { BigNumber, BigNumberish } from "ethers"
import { ConfigTracker } from "."
import { DecodedSignaturePart, WalletConfig } from ".."
import { PresignedConfigUpdate, PresignedConfigurationPayload } from "./config-tracker"

export class DebugConfigTracker implements ConfigTracker {
  public requests = 0

  constructor (
    public tracker: ConfigTracker
  ) { }

  _getRequest() {
    return this.requests++
  }

  loadPresignedConfiguration = async (args: { wallet: string; fromImageHash: string; chainId: BigNumberish; }): Promise<PresignedConfigUpdate[]> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] loadPresignedConfiguration(${args.wallet}, ${args.fromImageHash}, ${args.chainId})`)
    const result = await this.tracker.loadPresignedConfiguration(args)
    console.log(`[${id}] loadPresignedConfiguration(${args.wallet}, ${args.fromImageHash}, ${args.chainId}) => ${JSON.stringify(result)}`)
    return result
  }

  savePresignedConfiguration = (args: PresignedConfigurationPayload): Promise<void> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] savePresignedConfiguration(${JSON.stringify(args)})`)
    return this.tracker.savePresignedConfiguration(args)
  }

  configOfImageHash = async (args: { imageHash: string; }): Promise<WalletConfig | undefined> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] configOfImageHash(${args.imageHash})`)
    const result = await this.tracker.configOfImageHash(args)
    console.log(`[config-tracker ${id}] configOfImageHash(${args.imageHash}) => ${JSON.stringify(result)}`)
    return result
  }

  saveWalletConfig = (args: { config: WalletConfig; }): Promise<void> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] saveWalletConfig(${JSON.stringify(args)})`)
    return this.tracker.saveWalletConfig(args)
  }

  imageHashOfCounterFactualWallet = async (args: { context: WalletContext; wallet: string; }): Promise<string | undefined> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] imageHashOfCounterFactualWallet(${args.wallet}, ${JSON.stringify(args.context)})`)
    const result = await this.tracker.imageHashOfCounterFactualWallet(args)
    console.log(`[config-tracker ${id}] imageHashOfCounterFactualWallet(${args.wallet}, ${JSON.stringify(args.context)}) => ${JSON.stringify(result)}`)
    return result
  }

  saveCounterFactualWallet = (args: { imageHash: string; context: WalletContext; }): Promise<void> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] saveCounterFactualWallet(${args.imageHash}, ${JSON.stringify(args.context)})`)
    return this.tracker.saveCounterFactualWallet(args)
  }

  walletsOfSigner = async (args: { signer: string; }): Promise<{ wallet: string; proof: { digest: string; chainId: BigNumber; signature: DecodedSignaturePart; }; }[]> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] walletsOfSigner(${args.signer})`)
    const result = await this.tracker.walletsOfSigner(args)
    console.log(`[config-tracker ${id}] walletsOfSigner(${args.signer}) => ${JSON.stringify(result)}`)
    return result
  }

  signaturesOfSigner = async (args: { signer: string }): Promise<{ signature: string, chainid: BigNumber, wallet: string, digest: string }[]> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] signaturesOfSigner(${args.signer})`)
    const result = await this.tracker.signaturesOfSigner(args)
    console.log(`[config-tracker ${id}] signaturesOfSigner(${args.signer}) => ${JSON.stringify(result)}`)
    return result
  }

  saveWitness = async (args: { wallet: string, digest: string, signatures: { chainId: BigNumberish, signature: string }[] }): Promise<void> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] saveWitness(${args.wallet}, ${args.digest}, ${JSON.stringify(args.signatures)})`)
    return this.tracker.saveWitness(args)
  }

  imageHashesOfSigner = async (args: { signer: string }): Promise<string[]> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] imageHashesOfSigner(${args.signer})`)
    const result = await this.tracker.imageHashesOfSigner(args)
    console.log(`[config-tracker ${id}] imageHashesOfSigner(${args.signer}) => ${JSON.stringify(result)}`)
    return result
  }

  signaturesForImageHash = async (args: {imageHash: string}): Promise<{ signer: string, signature: string, chainId: BigNumber, wallet: string, digest: string }[]> => {
    const id = this._getRequest()
    console.log(`[config-tracker ${id}] signaturesForImageHash(${args.imageHash})`)
    const result = await this.tracker.signaturesForImageHash(args)
    console.log(`[config-tracker ${id}] signaturesForImageHash(${args.imageHash}) => ${JSON.stringify(result)}`)
    return result
  }
}
