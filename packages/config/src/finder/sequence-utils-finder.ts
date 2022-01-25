import { Contract, ethers } from 'ethers'
import { addressOf, imageHash, WalletConfig } from '..'
import { getCachedConfig } from '../cache'
import { ConfigFinder } from './config-finder'
import { walletContracts } from '@0xsequence/abi'
import { WalletContext } from '@0xsequence/network'
import { logger } from '@0xsequence/utils'

export class SequenceUtilsFinder implements ConfigFinder {
  constructor(public authProvider: ethers.providers.Provider) {}

  findCurrentConfig = async (args: {
    address: string
    provider: ethers.providers.Provider
    context: WalletContext
    knownConfigs?: WalletConfig[]
    ignoreIndex?: boolean
    requireIndex?: boolean
    skipCache?: boolean
  }): Promise<{ config: WalletConfig | undefined }> => {
    const { provider, context, ignoreIndex, requireIndex, skipCache } = args
    const address = ethers.utils.getAddress(args.address)

    logger.info(`[findCurrentConfig] address:${address}, ignoreIndex:${ignoreIndex}, requireIndex:${requireIndex}`)

    if (requireIndex && ignoreIndex) throw Error(`findCurrentConfig: can't ignore index and require index`)

    const chainIdPromise = provider.getNetwork()
    const knownConfigs = args.knownConfigs ? args.knownConfigs : []

    // Get imageHash of wallet
    const { imageHash, config } = await this.findCurrentImageHash(context, provider, address, knownConfigs, skipCache)
    if (imageHash === undefined) return { config: undefined }

    // Get config for that imageHash
    const found = await this.findConfigForImageHash(
      context,
      imageHash,
      config ? [config, ...knownConfigs] : knownConfigs,
      skipCache
    )
    const chainId = (await chainIdPromise).chainId

    return {
      config: found ? { ...found, chainId, address } : undefined
    }
  }

  findLastWalletOfInitialSigner = async (args: {
    signer: string
    provider: ethers.providers.Provider
    context: WalletContext
    ignoreIndex?: boolean
    requireIndex?: boolean
  }): Promise<{ wallet: string | undefined }> => {
    const { signer, context, ignoreIndex, requireIndex } = args

    logger.info(`[findLastWalletOfInitialSigner] signer:${signer}`)

    if (requireIndex && ignoreIndex) throw Error(`findCurrentConfig: can't ignore index and require index`)

    const authContract = new Contract(context.sequenceUtils!, walletContracts.sequenceUtils.abi, this.authProvider)
    const logBlockHeight = ignoreIndex ? 0 : (await authContract.lastSignerUpdate(signer)).toNumber()
    if (requireIndex && logBlockHeight === 0) return { wallet: undefined }
    const filter = authContract.filters.RequiredSigner(null, signer)
    const lastLog = await this.findLatestLog(this.authProvider, {
      ...filter,
      fromBlock: logBlockHeight,
      toBlock: logBlockHeight !== 0 ? logBlockHeight : 'latest'
    })
    if (lastLog === undefined) {
      logger.warn('publishConfig: wallet config last log not found')
      return { wallet: undefined }
    }
    const event = authContract.interface.decodeEventLog('RequiredSigner', lastLog.data, lastLog.topics)
    return { wallet: event._wallet }
  }

  findConfigForImageHash = async (
    context: WalletContext,
    image: string,
    knownConfigs: WalletConfig[] = [],
    skipCache: boolean = false
  ): Promise<WalletConfig | undefined> => {
    // Lookup config in known configurations
    const found = knownConfigs.find(kc => imageHash(kc) === image)
    if (found) return found

    // Lookup config in cached configurations
    if (!skipCache) {
      const cached = getCachedConfig(image)
      if (cached) {
        return cached
      }
    }

    logger.info(`[findConfigForImageHash] image:${image}`)

    // Load index for last imageHash update
    const authContract = new Contract(context.sequenceUtils!, walletContracts.sequenceUtils.abi, this.authProvider)
    const imageHashHeight = (await authContract.lastImageHashUpdate(image)).toNumber() as number

    // Get requireConfig with imageHash info
    const filter = authContract.filters.RequiredConfig(undefined, image)
    const lastLog = await this.findLatestLog(this.authProvider, {
      ...filter,
      fromBlock: imageHashHeight,
      toBlock: imageHashHeight !== 0 ? imageHashHeight : 'latest'
    })

    // If there is no log, and no knownConfig...
    // the config is not found
    if (lastLog === undefined) return undefined

    const event = authContract.interface.decodeEventLog('RequiredConfig', lastLog.data, lastLog.topics)
    const signers = ethers.utils.defaultAbiCoder.decode(
      [
        `tuple(
        uint256 weight,
        address signer
      )[]`
      ],
      event._signers
    )[0]

    const config = {
      threshold: ethers.BigNumber.from(event._threshold).toNumber(),
      signers: signers.map((s: any) => ({
        address: s.signer,
        weight: ethers.BigNumber.from(s.weight).toNumber()
      }))
    }

    // Cache this config
    imageHash(config)

    return config
  }

  findCurrentImageHash = async (
    context: WalletContext,
    provider: ethers.providers.Provider,
    address: string,
    knownConfigs: WalletConfig[] = [],
    skipCache?: boolean
  ): Promise<{ imageHash?: string; config?: WalletConfig }> => {
    logger.info(`[findCurrentImageHash] address:${address}`)

    const walletContract = new Contract(address, walletContracts.mainModuleUpgradable.abi, provider)
    const currentImageHash = (await walletContract.functions.imageHash.call([]).catch(() => [])) as string[]

    // Wallet is not counterfactual and has a defined imageHash
    if (currentImageHash[0] !== undefined) {
      return {
        imageHash: currentImageHash[0],
        config: skipCache ? undefined : getCachedConfig(currentImageHash[0])
      }
    }

    // Wallet is in counter-factual mode
    // Lookup config in known configurations
    const normalizedAddress = ethers.utils.getAddress(address)
    const found = knownConfigs.find(kc => addressOf(kc, context, true) === normalizedAddress)
    if (found) return { imageHash: imageHash(found), config: found }

    // Call wallet index
    const authContract = new Contract(context.sequenceUtils!, walletContracts.sequenceUtils.abi, this.authProvider)
    const knownImageHash = (await authContract.knownImageHashes(address)) as string

    if (knownImageHash !== ethers.constants.HashZero) {
      if (addressOf(knownImageHash, context) !== address) throw Error('findCurrentImageHash: inconsistent RequireUtils results')
      return { imageHash: knownImageHash }
    }

    // Get known image hash from raw logs, as last resort
    const filter = authContract.filters.RequiredConfig(address)
    const log = await this.findFirstLog(this.authProvider, filter)

    if (log !== undefined) {
      const event = authContract.interface.decodeEventLog('RequiredConfig', log.data, log.topics)
      const signers = ethers.utils.defaultAbiCoder.decode(
        [
          `tuple(
          uint256 weight,
          address signer
        )[]`
        ],
        event._signers
      )[0]

      const config = {
        threshold: ethers.BigNumber.from(event._threshold).toNumber(),
        signers: signers.map((s: any) => ({
          address: s.signer,
          weight: ethers.BigNumber.from(s.weight).toNumber()
        }))
      }

      const gotImageHash = imageHash(config)
      if (addressOf(gotImageHash, context) === address) {
        return { imageHash: gotImageHash, config }
      }
    }

    // Counter-factual imageHash not found
    return {}
  }

  private findLatestLog = async (
    provider: ethers.providers.Provider,
    filter: ethers.providers.Filter
  ): Promise<ethers.providers.Log | undefined> => {
    const toBlock = filter.toBlock === 'latest' ? await provider.getBlockNumber() : (filter.toBlock as number)
    const fromBlock = filter.fromBlock as number

    if (fromBlock === 0) {
      logger.warn(`findLatestLog: expensive getLogs query fromBlock 0 toBlock ${toBlock}`)
    }

    try {
      const logs = await provider.getLogs({ ...filter, toBlock: toBlock })
      return logs.length === 0 ? undefined : logs[logs.length - 1]
    } catch (e) {
      // TODO Don't assume all errors are bad
      const pivot = Math.floor((toBlock - fromBlock) / 2 + fromBlock)
      const nhalf = await this.findLatestLog(provider, { ...filter, fromBlock: pivot, toBlock: toBlock })
      if (nhalf !== undefined) return nhalf
      return this.findLatestLog(provider, { ...filter, fromBlock: fromBlock, toBlock: pivot })
    }
  }

  private findFirstLog = async (
    provider: ethers.providers.Provider,
    filter: ethers.providers.Filter
  ): Promise<ethers.providers.Log | undefined> => {
    const toBlock = filter.toBlock === 'latest' || !filter.toBlock ? await provider.getBlockNumber() : (filter.toBlock as number)
    const fromBlock = filter.fromBlock ? (filter.fromBlock as number) : 0

    if (fromBlock === 0) {
      logger.warn(`findFirstLog: expensive getLogs query fromBlock 0 toBlock ${toBlock}`)
    }

    try {
      const logs = await provider.getLogs({ ...filter, fromBlock, toBlock })
      return logs.length === 0 ? undefined : logs[0]
    } catch (e) {
      // TODO Don't assume all errors are bad
      const pivot = Math.floor((toBlock - fromBlock) / 2 + fromBlock)
      const nhalf = await this.findFirstLog(provider, { ...filter, fromBlock, toBlock: pivot })
      if (nhalf !== undefined) return nhalf
      return this.findFirstLog(provider, { ...filter, fromBlock: pivot, toBlock })
    }
  }
}
