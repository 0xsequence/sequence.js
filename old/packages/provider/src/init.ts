import {
  CachedProvider,
  ChainIdLike,
  NetworkConfig,
  allNetworks,
  exceptionProviderMiddleware,
  findNetworkConfig,
  loggingProviderMiddleware,
  JsonRpcProvider
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

  let networks: NetworkConfig[] = []

  const updateNetworks = (connectedNetworks: NetworkConfig[] = []) => {
    networks = mergeNetworks(allNetworks, connectedNetworks, config.networks ?? [])

    // Append projectAccessKey to network rpcUrls
    networks = networks.map(network => {
      // Don't double-append in the case the user has already included their access key in the rpc URL
      if (network.rpcUrl.includes(projectAccessKey)) {
        return network
      }

      // XXX: This will probably break non-sequence RPC provider URLs.
      network.rpcUrl = network.rpcUrl + `/${projectAccessKey}`

      return network
    })
  }

  updateNetworks()

  // This is the starting default network (as defined by the config)
  // it can be later be changed using `wallet_switchEthereumChain` or some
  // of the other methods on the provider.
  const defaultNetwork = config.defaultNetwork ? findNetworkConfig(networks, config.defaultNetwork)?.chainId : undefined
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

  updateNetworks(client.getSession()?.networks)

  client.onConnect(ev => {
    updateNetworks(ev.session?.networks)
  })

  const rpcProviders: Record<string, ethers.JsonRpcProvider> = {}

  // This builds a "public rpc" on demand, we build them on demand because we don't want to
  // generate a bunch of providers for networks that aren't used.
  const providerForChainId = (chainId: number) => {
    const network = findNetworkConfig(networks, chainId)

    if (!network) {
      throw new Error(`no network config found for chainId: ${chainId}`)
    }

    const { rpcUrl } = network

    // Cache providers by rpc url
    if (!rpcProviders[rpcUrl]) {
      rpcProviders[rpcUrl] = new JsonRpcProvider(
        rpcUrl,
        {
          middlewares: [loggingProviderMiddleware, exceptionProviderMiddleware, new CachedProvider()]
        },
        { cacheTimeout: -1 }
      )
    }

    return rpcProviders[rpcUrl]
  }

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

// allNetworks <- connectedNetworks <- config.networks
const mergeNetworks = (...networks: Partial<NetworkConfig>[][]) => {
  const networkMap = new Map<number, NetworkConfig>()

  for (const network of networks.flat()) {
    if (network.chainId && network.rpcUrl) {
      const existingNetwork = networkMap.get(network.chainId)

      networkMap.set(network.chainId, { ...existingNetwork, ...network } as NetworkConfig)
    }
  }

  return Array.from(networkMap.values())
}
