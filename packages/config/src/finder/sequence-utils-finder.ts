import { Contract, ethers } from "ethers"
import { addressOf, imageHash, WalletConfig } from ".."
import { ConfigFinder } from "./config-finder"
import { walletContracts } from '@0xsequence/abi'
import { WalletContext } from "@0xsequence/network"


export class SequenceUtilsFinder implements ConfigFinder {
  constructor(public authProvider: ethers.providers.Provider) {}

  findCurrentConfig = async (args:  {
    address: string,
    provider: ethers.providers.Provider,
    context: WalletContext,
    knownConfigs?: WalletConfig[],
    ignoreIndex?: boolean
  }): Promise<{ config: WalletConfig }> => {
    const { address, provider, context, ignoreIndex } = args
    const knownConfigs = args.knownConfigs ? args.knownConfigs : []

    const chainId = (await provider.getNetwork()).chainId

    // fetch current wallet image hash from chain, and skip any errors
    const walletContract = new Contract(address, walletContracts.mainModuleUpgradable.abi, provider)
    const currentImageHash = await (walletContract.functions.imageHash.call([]).catch(() => [])) as string[]

    // fetch wallet implementation, which tells us if its been deployed, and verifies its the main module
    const currentImplementation = ethers.utils.defaultAbiCoder.decode(
      ['address'],
      ethers.utils.hexZeroPad(
        await (provider.getStorageAt(address, address).catch(() => ethers.constants.AddressZero)), 32
      )
    )[0]

    const authContract = new Contract(context.sequenceUtils, walletContracts.sequenceUtils.abi, this.authProvider)

    if (currentImplementation === context.mainModuleUpgradable) {
      const foundConfig = knownConfigs.find((k) => imageHash(k) === currentImageHash[0])
      if (foundConfig) {
        return { config: { ...foundConfig, address, chainId } }
      }
    } else {
      const foundConfig = knownConfigs.find((k) => addressOf({ ...k, address: undefined}, context).toLowerCase() === address.toLowerCase())
      if (foundConfig) {
        return { config: { ...{ ...foundConfig, address: undefined }, chainId } }
      }
    }

    // Get last known configuration
    const logBlockHeight = ignoreIndex ? 0 : (await authContract.lastWalletUpdate(address)).toNumber()
    const filter = authContract.filters.RequiredConfig(address)
    const lastLog = await this.findLatestLog(this.authProvider, { ...filter, fromBlock: logBlockHeight, toBlock: logBlockHeight !== 0 ? logBlockHeight : 'latest'})
    if (lastLog === undefined) { console.warn("publishConfig: wallet config last log not found"); return { config: undefined } }
    const event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)

    const signers = ethers.utils.defaultAbiCoder.decode(
      [`tuple(
        uint256 weight,
        address signer
      )[]`], event._signers
    )[0]

    const config = {
      chainId: chainId,
      address: address,
      threshold: ethers.BigNumber.from(event._threshold).toNumber(),
      signers: signers.map((s: any) => ({
        address: s.signer,
        weight: ethers.BigNumber.from(s.weight).toNumber()
      }))
    }

    const isValid = currentImplementation === context.mainModuleUpgradable ? imageHash(config) === currentImageHash[0] : addressOf(config, context) === address
    if (!isValid) {
      if (ignoreIndex) {
        console.warn('No valid configuration found')
        return { config: undefined }
      } else {
        // Re-try but skip index
        return this.findCurrentConfig({ ...args, ignoreIndex: true })
      }
    }

    return { config: config }
  }

  findLastWalletOfSigner = async (args:  {
    signer: string,
    provider: ethers.providers.Provider,
    context: WalletContext,
    knownConfigs?: WalletConfig[],
    ignoreIndex?: boolean
  }): Promise<{ wallet: string }> => {
    throw Error('Not implemented')
  }

  private findLatestLog = async (provider: ethers.providers.Provider, filter: ethers.providers.Filter): Promise<ethers.providers.Log | undefined> => {
    const toBlock = filter.toBlock === 'latest' ? await provider.getBlockNumber() : filter.toBlock as number
    const fromBlock = filter.fromBlock as number
  
    try {
      const logs = await provider.getLogs({ ...filter, toBlock: toBlock })
      return logs.length === 0 ? undefined : logs[logs.length - 1]
    } catch (e) {
      // TODO Don't assume all errors are bad
      const pivot = Math.floor(((toBlock - fromBlock) / 2) + fromBlock)
      const nhalf = await this.findLatestLog(provider, { ...filter, fromBlock: pivot, toBlock: toBlock })
      if (nhalf !== undefined) return nhalf
      return this.findLatestLog(provider, { ...filter, fromBlock: fromBlock, toBlock: pivot })
    }
  }
}
