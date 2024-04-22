import { BigNumberish, ethers, providers } from 'ethers'
import { Indexer } from '@0xsequence/indexer'
import { Relayer, RpcRelayerOptions } from '@0xsequence/relayer'
import { findNetworkConfig, stringTemplate, validateAndSortNetworks } from './utils'
import { isBigNumberish } from '@0xsequence/utils'
import { ChainId, NetworkMetadata, networks } from './constants'

export type NetworkConfig = NetworkMetadata & {
  rpcUrl: string
  provider?: providers.Provider
  indexerUrl?: string
  indexer?: Indexer
  relayer?: Relayer | RpcRelayerOptions

  // isDefaultChain identifies the default network. For example, a dapp may run on the Polygon
  // network and may configure the wallet to use it as its main/default chain.
  isDefaultChain?: boolean

  // Disabled / deprecated chain
  disabled?: boolean
}

type LegacyNetworkConfig = NetworkConfig & { isAuthChain?: boolean }

export const indexerURL = (network: string) => stringTemplate('https://${network}-indexer.sequence.app', { network })
export const relayerURL = (network: string) => stringTemplate('https://${network}-relayer.sequence.app', { network })
export const nodesURL = (network: string) => stringTemplate('https://nodes.sequence.app/${network}', { network })

export function findSupportedNetwork(chainIdOrName: string | ChainIdLike): NetworkConfig | undefined {
  return findNetworkConfig(allNetworks, chainIdOrName)
}

export type ChainIdLike = NetworkConfig | BigNumberish

export function toChainIdNumber(chainIdLike: ChainIdLike): ethers.BigNumber {
  if (ethers.BigNumber.isBigNumber(chainIdLike)) {
    return chainIdLike
  }

  if (isBigNumberish(chainIdLike)) {
    return ethers.BigNumber.from(chainIdLike)
  }

  return ethers.BigNumber.from(chainIdLike.chainId)
}

const genUrls = (network: string) => {
  const rpcUrl = nodesURL(network)
  return {
    rpcUrl,
    relayer: {
      url: relayerURL(network),
      provider: {
        url: rpcUrl
      }
    },
    indexerUrl: indexerURL(network)
  }
}

export const allNetworks = validateAndSortNetworks([
  {
    ...networks[ChainId.POLYGON],
    ...genUrls('polygon'),
    isDefaultChain: true,
    isAuthChain: true
  } as LegacyNetworkConfig,
  {
    ...networks[ChainId.MAINNET],
    ...genUrls('mainnet')
  },
  {
    ...networks[ChainId.BSC],
    ...genUrls('bsc')
  },
  {
    ...networks[ChainId.AVALANCHE],
    ...genUrls('avalanche')
  },
  {
    ...networks[ChainId.ARBITRUM],
    ...genUrls('arbitrum')
  },
  {
    ...networks[ChainId.ARBITRUM_NOVA],
    ...genUrls('arbitrum-nova')
  },
  {
    ...networks[ChainId.OPTIMISM],
    ...genUrls('optimism')
  },
  {
    ...networks[ChainId.OPTIMISM_SEPOLIA],
    ...genUrls('optimism-sepolia')
  },
  {
    ...networks[ChainId.POLYGON_ZKEVM],
    ...genUrls('polygon-zkevm')
  },
  {
    ...networks[ChainId.GNOSIS],
    ...genUrls('gnosis')
  },
  {
    ...networks[ChainId.RINKEBY],
    ...genUrls('rinkeby'),
    disabled: true
  },
  {
    ...networks[ChainId.GOERLI],
    ...genUrls('goerli'),
    disabled: true
  },
  {
    ...networks[ChainId.SEPOLIA],
    ...genUrls('sepolia')
  },
  {
    ...networks[ChainId.POLYGON_MUMBAI],
    ...genUrls('mumbai'),
    disabled: true
  },
  {
    ...networks[ChainId.POLYGON_AMOY],
    ...genUrls('amoy')
  },
  {
    ...networks[ChainId.BSC_TESTNET],
    ...genUrls('bsc-testnet')
  },
  {
    ...networks[ChainId.ARBITRUM_SEPOLIA],
    ...genUrls('arbitrum-sepolia')
  },
  {
    ...networks[ChainId.BASE],
    ...genUrls('base')
  },
  {
    ...networks[ChainId.BASE_SEPOLIA],
    ...genUrls('base-sepolia')
  },
  {
    ...networks[ChainId.HOMEVERSE],
    ...genUrls('homeverse')
  },
  {
    ...networks[ChainId.HOMEVERSE_TESTNET],
    ...genUrls('homeverse-testnet')
  },
  {
    ...networks[ChainId.XAI],
    ...genUrls('xai')
  },
  {
    ...networks[ChainId.XAI_SEPOLIA],
    ...genUrls('xai-sepolia')
  },
  {
    ...networks[ChainId.AVALANCHE_TESTNET],
    ...genUrls('avalanche-testnet')
  },
  {
    ...networks[ChainId.ASTAR_ZKEVM],
    ...genUrls('astar-zkevm')
  },
  {
    ...networks[ChainId.ASTAR_ZKYOTO],
    ...genUrls('astar-zkyoto')
  },
  {
    ...networks[ChainId.XR_SEPOLIA],
    ...genUrls('xr-sepolia')
  },
  {
    ...networks[ChainId.HARDHAT],
    rpcUrl: 'http://localhost:8545',
    relayer: {
      url: 'http://localhost:3000',
      provider: {
        url: 'http://localhost:8545'
      }
    }
  },
  {
    ...networks[ChainId.HARDHAT_2],
    rpcUrl: 'http://localhost:9545',
    relayer: {
      url: 'http://localhost:3000',
      provider: {
        url: 'http://localhost:9545'
      }
    }
  }
])
