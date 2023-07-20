import { CachedProvider, ChainIdLike, JsonRpcRouter, JsonRpcSender, NetworkConfig, allNetworks, exceptionProviderMiddleware, findNetworkConfig, loggingProviderMiddleware } from "@0xsequence/network"
import { ExtensionMessageProvider, MuxMessageProvider, ProxyMessageChannelPort, ProxyMessageProvider, UnrealMessageProvider, WindowMessageProvider } from "./transports"
import { ItemStore, LocalStorage } from "./utils"
import { Runtime } from "webextension-polyfill"
import { ethers } from "ethers"
import { SequenceClient } from "./client"
import { SequenceProvider } from "./provider"


export interface ProviderConfig {
  // The local storage dependency for the wallet provider, defaults to window.localStorage.
  // For example, this option should be used when using React Native since window.localStorage is not available.
  localStorage?: ItemStore

  // Sequence Wallet App URL, default: https://sequence.app
  walletAppURL: string

  // defaultNetwork is the primary network of a dapp and the default network a
  // provider will communicate. Note: this setting is also configurable from the
  // Wallet constructor's first argument. If both are specified, then they
  // need to match
  defaultNetwork?: ChainIdLike

  // networks is a configuration list of networks used by the wallet. This list
  // is combined with the network list specified by sequence.js.
  // notice that this can only replace the rpc urls on the dapp side,
  // the networks on wallet-webapp side remain the same.
  //
  // NOTICE: It's not possible to define networks that aren't already
  // defined in sequence.js.
  networks?: Partial<NetworkConfig>[]

  // networkRpcUrl will set the provider rpcUrl of the default network
  networkRpcUrl?: string

  // transports for dapp to wallet jron-rpc communication
  transports?: {
    // WindowMessage transport (optional)
    windowTransport?: {
      enabled: boolean
    }

    // ProxyMessage transport (optional)
    proxyTransport?: {
      enabled: boolean
      appPort?: ProxyMessageChannelPort
    }

    // Extension transport (optional)
    extensionTransport?: {
      enabled: boolean
      runtime: Runtime.Static
    }

    // Unreal Engine transport (optional)
    unrealTransport?: {
      enabled: boolean
    }
  }
}

export const DefaultProviderConfig: ProviderConfig = {
  walletAppURL: 'https://sequence.app',

  transports: {
    windowTransport: { enabled: true },
    proxyTransport: { enabled: false }
  },

  defaultNetwork: 1,
  defaultNetworkId: 1
} as any

let sequenceWalletProvider: SequenceProvider | undefined

export const initWallet = (
  partialConfig?: Partial<ProviderConfig>
) => {
  if (sequenceWalletProvider) {
    return sequenceWalletProvider
  }

  // Combine both the provided config and the default config
  const config = { ...DefaultProviderConfig, ...partialConfig }
  const rpcProviders: Record<number, ethers.providers.JsonRpcProvider> = {}

  // We can't allow the dapp to define networks that aren't already defined in sequence.js
  // we may in the future, but the issue is that wallet-webapp won't have these new networks
  // either, so it will fail to connect to them.
  if (config.networks?.some((n) => {
    return !allNetworks.find((cn) => cn.chainId === n.chainId)
  })) {
    throw new Error('networks config must only contain networks defined in sequence.js')
  }

  // Override any information about the networks using the config
  const combinedNetworks = allNetworks.map((n) => {
    const network = config.networks?.find((cn) => cn.chainId === n.chainId)
    return network ? { ...n, ...network } : n
  })

  // This build a "public rpc" on demand, we build them on demand because we don't want to
  // generate a bunch of providers for networks that aren't used.
  const providerForChainId = (chainId: number) => {
    if (!rpcProviders[chainId]) {
      const rpcUrl = combinedNetworks.find((n) => n.chainId === chainId)?.rpcUrl
      if (!rpcUrl) {
        throw new Error(`no rpcUrl found for chainId: ${chainId}`)
      }

      const baseProvider = new ethers.providers.JsonRpcProvider(rpcUrl)
      const router = new JsonRpcRouter(
        [
          loggingProviderMiddleware,
          exceptionProviderMiddleware,
          new CachedProvider()
        ],
        new JsonRpcSender(baseProvider)
      )
  
      rpcProviders[chainId] = new ethers.providers.Web3Provider(router, chainId)
    }

    return rpcProviders[chainId]
  }

  // Build transport
  // TODO: Move this to transports
  const muxMessageProvider = new MuxMessageProvider()

  if (config.transports?.windowTransport?.enabled && typeof window === 'object') {
    const windowMessageProvider = new WindowMessageProvider(config.walletAppURL)
    muxMessageProvider.add(windowMessageProvider)
  }

  if (config.transports?.proxyTransport?.enabled) {
   const proxyMessageProvider = new ProxyMessageProvider(config.transports.proxyTransport.appPort!)
   muxMessageProvider.add(proxyMessageProvider)
  }

  if (config.transports?.extensionTransport?.enabled) {
    const extensionMessageProvider = new ExtensionMessageProvider(config.transports.extensionTransport.runtime)
    muxMessageProvider.add(extensionMessageProvider)

    // NOTE/REVIEW: see note in mux-message-provider
    //
    // We don't add the extensionMessageProvider here because we don't send requests to it anyways, we seem to
    // send all requests to the WindowMessageProvider anyways. By allowing it, if browser restarts, it will break
    // the entire extension because messageProvider.provider will be undefined. So this is a hack to fix it.
  }

  if (config.transports?.unrealTransport?.enabled) {
    const unrealMessageProvider = new UnrealMessageProvider(config.walletAppURL)
    muxMessageProvider.add(unrealMessageProvider)
  }

  muxMessageProvider.register()

  // This is the starting default network (as defined by the config)
  // it can be later be changed using `wallet_switchEthereumChain` or some
  // of the other methods on the provider.
  const defaultNetwork = config.defaultNetwork ? findNetworkConfig(combinedNetworks, config.defaultNetwork)?.chainId : undefined
  if (!defaultNetwork && config.defaultNetwork) {
    throw new Error(`defaultNetwork not found for chainId: ${config.defaultNetwork}`)
  }

  // Generate ItemStore
  const itemStore = config.localStorage || LocalStorage.getInstance()

  // Create client, provider and return signer
  const client = new SequenceClient(muxMessageProvider, itemStore, defaultNetwork)
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
