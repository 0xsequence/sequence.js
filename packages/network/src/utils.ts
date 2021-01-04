import { ethers, BigNumberish } from 'ethers'
import { NetworkConfig, Networks, NetworksBuilder, ChainId } from './config'

export function isNetworkConfig(cand: any): cand is NetworkConfig {
  return cand && cand.chainId !== undefined && cand.name !== undefined &&
    cand.rpcUrl !== undefined && cand.relayer !== undefined
}

export const getNetworkId = (chainId: ChainId): number => {
  if (typeof(chainId) === 'number') {
    return chainId
  }
  if ((<NetworkConfig>chainId).chainId) {
    return ((<NetworkConfig>chainId)).chainId
  }
  return ethers.BigNumber.from(chainId as BigNumberish).toNumber()
}

export const maybeNetworkId = (chainId?: ChainId): number | undefined => {
  if (!chainId) return undefined
  return getNetworkId(chainId)
}

export const isValidNetworkConfig = (networkConfig: NetworkConfig | NetworkConfig[], raise: boolean = false): boolean => {
  const configs: NetworkConfig[] = []
  if (Array.isArray(networkConfig)) {
    configs.push(...networkConfig)
  } else {
    configs.push(networkConfig)
  }

  if (configs.length === 0) {
    if (raise) throw new Error(`invalid network config: empty config`)
    return false
  }

  // Ensure no duplicate chainId configs
  const chainIds = configs.map(c => c.chainId).sort()
  const dupes = chainIds.filter((c, i) => chainIds.indexOf(c) !== i)
  if (dupes.length > 0) {
    if (raise) throw new Error(`invalid network config: duplicate chainIds ${dupes}`)
    return false
  }

  // Ensure rpcUrl or provider is specified
  // Ensure relayerUrl or relayer is specified
  // Ensure one main chain
  // Ensure one auth chain
  let mainChain = false
  let authChain = false
  for (let i=0; i < configs.length; i++) {
    const c = configs[i]
    if ((!c.rpcUrl || c.rpcUrl === '') && !c.provider) {
      if (raise) throw new Error(`invalid network config for chainId ${c.chainId}: rpcUrl or provider must be provided`)
      return false
    }
    if ((!c.relayerUrl || c.relayerUrl === '') && !c.relayer) {
      if (raise) throw new Error(`invalid network config for chainId ${c.chainId}: relayerUrl or relayer must be provided`)
      return false
    }
    if (c.isMainChain) {
      if (mainChain) {
        if (raise) throw new Error(`invalid network config for chainId ${c.chainId}: MainChain is already set by another config`)
        return false
      }
      mainChain = true
    }
    if (c.isAuthChain) {
      if (authChain) {
        if (raise) throw new Error(`invalid network config for chainId ${c.chainId}: AuthChain is already set by another config`)
      }
      authChain = true
    }

    if (c.sidechains && c.sidechains.length > 0) {
      if (!isValidNetworkConfig(c.sidechains)) {
        return false
      }
    }
  }

  if (!mainChain) {
    if (raise) throw new Error(`invalid network config: MainChain must be set`)
    return false
  }
  if (!authChain) {
    if (raise) throw new Error(`invalid network config: AuthChain must be set`)
    return false
  }

  return true
}

export const ensureValidNetworks = (networks: NetworkConfig[]): NetworkConfig[] => {
  isValidNetworkConfig(networks, true)
  return networks
}

// sortNetworks orders the network config list by: mainChain, authChain, ..rest by chainId ascending numbers
export const sortNetworks = (networks: Networks): Networks => {
  const config = networks.sort((a, b) => {
    if (a.chainId === b.chainId) return 0
    return a.chainId < b.chainId ? -1 : 1
  })

  // AuthChain goes first
  const authConfigIdx = config.findIndex(c => c.isAuthChain)
  if (authConfigIdx > 0) config.splice(0, 0, config.splice(authConfigIdx, 1)[0])

  // MainChain goes second
  const mainConfigIdx = config.findIndex(c => c.isMainChain && c.isAuthChain !== true)
  if (mainConfigIdx > 0) config.splice(1, 0, config.splice(mainConfigIdx, 1)[0])

  return config
}

export const createNetworkConfig = (networks: Networks | NetworksBuilder, mainChainId?: number, vars?: {[key: string]: any}): Networks => {
  let config: NetworkConfig[] = []
  if (typeof(networks) === 'function') {
    config = networks(vars)
  } else {
    config = networks
  }

  if (mainChainId) {
    config.forEach(n => n.isMainChain = false)
    const mainNetwork = config.filter(n => n.chainId === mainChainId)
    if (!mainNetwork || mainNetwork.length === 0) {
      throw new Error(`mainChainId ${mainChainId} cannot be found in network list`)
    } else {
      mainNetwork[0].isMainChain = true
    }
  }

  return ensureValidNetworks(sortNetworks(config))
}
