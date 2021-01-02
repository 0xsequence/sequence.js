import { ethers, BigNumberish } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Relayer } from '@0xsequence/relayer'

export interface NetworkConfig {
  name: string
  chainId: number
  ensAddress?: string

  rpcUrl: string
  provider?: JsonRpcProvider

  relayerUrl?: string
  relayer?: Relayer

  sidechains?: NetworkConfig[]

  isMainChain?: boolean
  isAuthChain?: boolean
}

export type Networks = NetworkConfig[]

export type ChainId = NetworkConfig | BigNumberish

export function isNetworkConfig(cand: any): cand is NetworkConfig {
  return cand && cand.chainId !== undefined && cand.name !== undefined &&
    cand.rpcUrl !== undefined && cand.relayer !== undefined
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

export const ensureValidNetworkConfig = (networkConfig: NetworkConfig | NetworkConfig[]): boolean => {
  return isValidNetworkConfig(networkConfig, true)
}

export const getNetworkId = (chainId: ChainId): number => {
  if ((<NetworkConfig>chainId).chainId) {
    return ((<NetworkConfig>chainId)).chainId
  }
  return ethers.BigNumber.from(chainId as BigNumberish).toNumber()
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


export const createNetworkConfig = (baseRpcUrl: string, baseRelayerUrl: string): Networks => {
  // TODO: prevent double slashes when building urls

  // TODO: rest..

  // TODO: cyclic dep is causing some issues in using RpcRelayer directly here..

  return sortNetworks([
    {
      name: 'mainnet',
      chainId: 1,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: `${baseRpcUrl}/mainnet`,
      relayerUrl: `${baseRelayerUrl}/mainnet`,
      isMainChain: true
    },
    
    {
      name: 'morden',
      chainId: 2,
      rpcUrl: '', // TODO: ..... etc.. and use a proxy..
      // relayer: null
    },
    
    {
      name: 'ropsten',
      chainId: 3,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: '',
      // relayer: null
    },
    
    {
      name: 'rinkeby',
      chainId: 4,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: '',
      relayer: null,
    },
    
    {
      name: 'goerli',
      chainId: 5,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: '',
      relayer: null
    },
  
    {
      name: 'kovan',
      chainId: 42,
      rpcUrl: '',
      relayer: null
    },
  
    {
      name: 'mumbai',
      chainId: 80001,
      rpcUrl: 'https://rpc-mumbai.matic.today',
      relayer: null
    },   
    
    {
      name: 'matic',
      chainId: 137,
      rpcUrl: 'https://rpc-mainnet.matic.network',
      relayer: null,
      isAuthChain: true
    }
  ])
}

export const sequenceNetworks = createNetworkConfig('https://ethereum-node.sequence.app', 'https://relayer.sequence.app')
