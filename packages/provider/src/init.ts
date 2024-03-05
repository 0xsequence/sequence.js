import {
  CachedProvider,
  ChainIdLike,
  JsonRpcRouter,
  JsonRpcSender,
  NetworkConfig,
  allNetworks,
  exceptionProviderMiddleware,
  findNetworkConfig,
  loggingProviderMiddleware
} from '@0xsequence/network'
import { MuxTransportTemplate } from './transports'
import { ItemStore, useBestStore } from './utils'
import { ethers } from 'ethers'
import { SequenceClient } from './client'
import { SequenceProvider } from './provider'

export interface ProviderConfig {
  // The local storage dependency for the wallet provider, defaults to window.localStorage.
  // For example, this option should be used when using React Native since window.localStorage is not available.
  localStorage?: ItemStore

  // defaultNetwork is the primary network of a dapp and the default network a
  // provider will communicate. Note: this setting is also configurable from the
  // Wallet constructor's first argument. If both are specified, then they
  // need to match
  defaultNetwork?: ChainIdLike

  // defaultEIP6492 defines if EIP-6492 is enabled by default when signing messages.
  defaultEIP6492?: boolean

  // networks is a configuration list of networks used by the wallet. This list
  // is combined with the network list specified by sequence.js.
  // notice that this can only replace the rpc urls on the dapp side,
  // the networks on wallet-webapp side remain the same.
  //
  // NOTICE: It's not possible to define networks that aren't already
  // defined in sequence.js.
  networks?: Partial<NetworkConfig>[]

  // transports for dapp to wallet jron-rpc communication
  transports?: MuxTransportTemplate

  // analytics .... (default: true)
  analytics?: boolean
}

export const DefaultProviderConfig = {
  transports: {
    walletAppURL: 'https://sequence.app',
    windowTransport: { enabled: true },
    proxyTransport: { enabled: false }
  },

  defaultNetwork: 1,
  analytics: true
}

let sequenceWalletProvider: SequenceProvider | undefined

/**
 * Initializes a wallet with the provided project access key and optional configuration.
 *
 * @param projectAccessKey - Access key for the project that can be obtained from Sequence Builder on sequence.build
 * @param partialConfig - Optional partial configuration for the wallet.
 * @returns The initialized wallet provider.
 * @throws Error if projectAccessKey is not provided, empty string or is not string.
 */
export const initWallet = (projectAccessKey: string, partialConfig?: Partial<ProviderConfig>) => {
  if (!projectAccessKey || typeof projectAccessKey !== 'string') {
    throw new Error('Please pass a projectAccessKey in initWallet.')
  }

  if (sequenceWalletProvider) {
    return sequenceWalletProvider
  }

  // Combine both the provided config and the default config
  const config = {
    ...DefaultProviderConfig,
    ...partialConfig,
    transports: {
      ...DefaultProviderConfig.transports,
      ...partialConfig?.transports
    }
  }

  const rpcProviders: Record<number, ethers.providers.JsonRpcProvider> = {}

  // Find any new networks that aren't already defined in sequence.js
  // and add them to the list of networks, (they must have a rpcUrl and chainId)
  const newNetworks = (config.networks?.filter(n => {
    n.rpcUrl !== undefined && n.chainId !== undefined && !allNetworks.find(an => an.chainId === n.chainId)
  }) ?? []) as NetworkConfig[]

  // Override any information about the networks using the config
  const combinedNetworks = allNetworks
    .map(n => {
      const network = config.networks?.find(cn => cn.chainId === n.chainId)
      return network ? { ...n, ...network } : n
    })
    .concat(newNetworks)
    .map(network => {
      // don't double-append in the case the user has already included their access key in the rpc URL
      if (network.rpcUrl.includes(projectAccessKey)) {
        return network
      }

      // this will probably break non-sequence RPC provider URLs.
      network.rpcUrl = network.rpcUrl + `/${projectAccessKey}`
      return network
    })

  // This builds a "public rpc" on demand, we build them on demand because we don't want to
  // generate a bunch of providers for networks that aren't used.
  const providerForChainId = (chainId: number) => {
    if (!rpcProviders[chainId]) {
      const rpcUrl = combinedNetworks.find(n => n.chainId === chainId)?.rpcUrl
      if (!rpcUrl) {
        throw new Error(`no rpcUrl found for chainId: ${chainId}`)
      }

      const baseProvider = new ethers.providers.JsonRpcProvider(rpcUrl)
      const router = new JsonRpcRouter(
        [loggingProviderMiddleware, exceptionProviderMiddleware, new CachedProvider()],
        new JsonRpcSender(baseProvider)
      )

      rpcProviders[chainId] = new ethers.providers.Web3Provider(router, chainId)
    }

    return rpcProviders[chainId]
  }

  // This is the starting default network (as defined by the config)
  // it can be later be changed using `wallet_switchEthereumChain` or some
  // of the other methods on the provider.
  const defaultNetwork = config.defaultNetwork ? findNetworkConfig(combinedNetworks, config.defaultNetwork)?.chainId : undefined
  if (!defaultNetwork && config.defaultNetwork) {
    throw new Error(`defaultNetwork not found for chainId: ${config.defaultNetwork}`)
  }

  // Generate ItemStore
  const itemStore = config.localStorage || useBestStore()

  // Create client, provider and return signer
  const client = new SequenceClient(config.transports, itemStore, {
    defaultChainId: defaultNetwork,
    defaultEIP6492: config.defaultEIP6492,
    projectAccessKey: projectAccessKey,
    analytics: config.analytics
  })

  sequenceWalletProvider = new SequenceProvider(client, providerForChainId)
  return sequenceWalletProvider
}

export const unregisterWallet = () => {
  if (!sequenceWalletProvider) return
  sequenceWalletProvider.client.closeWallet()
  sequenceWalletProvider.client.transport.unregister()
  sequenceWalletProvider = undefined
}

export const getWallet = () => {
  if (!sequenceWalletProvider) {
    throw new Error('Wallet has not been initialized, call sequence.initWallet(config) first.')
  }
  return sequenceWalletProvider
}
