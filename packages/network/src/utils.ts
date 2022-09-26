import { ethers, BigNumberish } from 'ethers'
import { ChainIdLike } from '.'
import { NetworkConfig } from './config'

export function isNetworkConfig(cand: any): cand is NetworkConfig {
  return cand && cand.chainId !== undefined && cand.name !== undefined && cand.rpcUrl !== undefined && cand.relayer !== undefined
}

export const getChainId = (chainId: ChainIdLike): number => {
  if (typeof chainId === 'number') {
    return chainId
  }
  if ((<NetworkConfig>chainId).chainId) {
    return (<NetworkConfig>chainId).chainId
  }
  return ethers.BigNumber.from(chainId as BigNumberish).toNumber()
}

export const maybeChainId = (chainId?: ChainIdLike): number | undefined => {
  if (!chainId) return undefined
  return getChainId(chainId)
}

export const getAuthNetwork = (networks: NetworkConfig[]): NetworkConfig | undefined => {
  return networks.find(network => network.isAuthChain)
}

export const isValidNetworkConfig = (
  networkConfig: NetworkConfig | NetworkConfig[],
  raise: boolean = false,
  skipRelayerCheck: boolean = false
): boolean => {
  if (!networkConfig) throw new Error(`invalid network config: empty config`)

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

  // Ensure distinct chainId configs
  const chainIds = configs.map(c => c.chainId).sort()
  const dupes = chainIds.filter((c, i) => chainIds.indexOf(c) !== i)
  if (dupes.length > 0) {
    if (raise) throw new Error(`invalid network config: duplicate chainIds ${dupes}`)
    return false
  }

  // Downcase all network names
  configs.forEach(c => (c.name = c.name.toLowerCase()))

  // Ensure distinct network names
  const names = configs.map(c => c.name).sort()
  const nameDupes = names.filter((c, i) => names.indexOf(c) !== i)
  if (nameDupes.length > 0) {
    if (raise) throw new Error(`invalid network config: duplicate network names ${nameDupes}`)
    return false
  }

  // Ensure rpcUrl or provider is specified
  // Ensure relayerUrl or relayer is specified
  // Ensure one default chain
  // Ensure one auth chain
  let defaultChain = false
  let authChain = false
  for (let i = 0; i < configs.length; i++) {
    const c = configs[i]
    if ((!c.rpcUrl || c.rpcUrl === '') && !c.provider) {
      if (raise) throw new Error(`invalid network config for chainId ${c.chainId}: rpcUrl or provider must be provided`)
      return false
    }
    if (!skipRelayerCheck) {
      if (!c.relayer) {
        if (raise) throw new Error(`invalid network config for chainId ${c.chainId}: relayer must be provided`)
        return false
      }
    }
    if (c.isDefaultChain) {
      if (defaultChain) {
        if (raise)
          throw new Error(`invalid network config for chainId ${c.chainId}: DefaultChain is already set by another config`)
        return false
      }
      defaultChain = true
    }
    if (c.isAuthChain) {
      if (authChain) {
        if (raise) throw new Error(`invalid network config for chainId ${c.chainId}: AuthChain is already set by another config`)
      }
      authChain = true
    }
  }

  if (!defaultChain) {
    if (raise) throw new Error(`invalid network config: DefaultChain must be set`)
    return false
  }
  if (!authChain) {
    if (raise) throw new Error(`invalid network config: AuthChain must be set`)
    return false
  }

  return true
}

export const ensureValidNetworks = (networks: NetworkConfig[], skipRelayerCheck: boolean = false): NetworkConfig[] => {
  isValidNetworkConfig(networks, true, skipRelayerCheck)
  return networks
}

export const ensureUniqueNetworks = (networks: NetworkConfig[], raise: boolean = true): boolean => {
  const chainIds = networks.map(c => c.chainId).sort()
  const dupes = chainIds.filter((c, i) => chainIds.indexOf(c) !== i)
  if (dupes.length > 0) {
    if (raise) throw new Error(`invalid network config: duplicate chainIds ${dupes}`)
    return false
  }
  return true
}

export const updateNetworkConfig = (src: Partial<NetworkConfig>, dest: NetworkConfig) => {
  if (!src || !dest) return

  if (!src.chainId && !src.name) {
    throw new Error('failed to update network config: source config is missing chainId or name')
  }
  if (src.chainId !== dest.chainId && src.name !== dest.name) {
    throw new Error('failed to update network config: one of chainId or name must match')
  }

  if (src.rpcUrl) {
    dest.rpcUrl = src.rpcUrl
    dest.provider = undefined
  }
  if (src.provider) {
    dest.provider = src.provider
  }
  if (src.relayer) {
    dest.relayer = src.relayer
  }
  // NOTE: we do not set default or auth chain from here
  // if (src.isDefaultChain) {
  //   dest.isDefaultChain = src.isDefaultChain
  // }
  // if (src.isAuthChain) {
  //   dest.isAuthChain = src.isAuthChain
  // }
}

export const validateAndSortNetworks = (networks: NetworkConfig[]) => {
  return ensureValidNetworks(sortNetworks(networks))
}

export const findNetworkConfig = (networks: NetworkConfig[], chainId: ChainIdLike): NetworkConfig | undefined => {
  if (typeof chainId === 'string') {
    if (chainId.startsWith('0x')) {
      const id = ethers.BigNumber.from(chainId).toNumber()
      return networks.find(n => n.chainId === id)
    } else {
      return networks.find(n => n.name === chainId)
    }
  } else if (typeof chainId === 'number') {
    return networks.find(n => n.chainId === chainId)
  } else if ((<NetworkConfig>chainId).chainId) {
    return networks.find(n => n.chainId === (<NetworkConfig>chainId).chainId)
  } else {
    return undefined
  }
}

export const checkNetworkConfig = (network: NetworkConfig, chainId: string | number): boolean => {
  if (!network) return false
  if (network.name === chainId) return true
  if (network.chainId === chainId) return true
  return false
}

export const networksIndex = (networks: NetworkConfig[]): { [key: string]: NetworkConfig } => {
  const index: { [key: string]: NetworkConfig } = {}
  for (let i = 0; i < networks.length; i++) {
    index[networks[i].name] = networks[i]
  }
  return index
}

// TODO: we should remove sortNetworks in the future but this is a breaking change for dapp integrations on older versions <-> wallet
// sortNetworks orders the network config list by: defaultChain, authChain, ..rest by chainId ascending numbers
export const sortNetworks = (networks: NetworkConfig[]): NetworkConfig[] => {
  if (!networks) {
    return []
  }

  const config = networks.sort((a, b) => {
    if (a.chainId === b.chainId) return 0
    return a.chainId < b.chainId ? -1 : 1
  })

  // DefaultChain goes first
  const defaultConfigIdx = config.findIndex(c => c.isDefaultChain)
  if (defaultConfigIdx > 0) config.splice(0, 0, config.splice(defaultConfigIdx, 1)[0])

  // AuthChain goes second
  const authConfigIdx = config.findIndex(c => c.isAuthChain && c.isDefaultChain !== true)
  if (authConfigIdx > 0) config.splice(1, 0, config.splice(authConfigIdx, 1)[0])

  return config
}

export const stringTemplate = (sTemplate: string, mData: any) => {
  if (typeof sTemplate === 'string') {
    mData = mData ? mData : {}
    return sTemplate.replace(/\$\{\s*([$#@\-\d\w]+)\s*\}/gim, function (fullMath, grp) {
      let val = mData[grp]
      if (typeof val === 'function') {
        val = val()
      } else if (val === null || val === undefined) {
        val = ''
      } else if (typeof val === 'object' || typeof val === 'symbol') {
        val = val.toString()
      } else {
        val = val.valueOf()
      }
      return val
    })
  }
  return ''
}
