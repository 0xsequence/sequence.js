import { BigNumberish, providers } from 'ethers'
import { Indexer } from '@0xsequence/indexer'
import { Relayer, RpcRelayerOptions } from '@0xsequence/relayer'
import { findNetworkConfig, stringTemplate, validateAndSortNetworks } from './utils'

export enum ChainId {
  // Ethereum
  MAINNET = 1,
  ROPSTEN = 3,
  RINKEBY = 4,
  GOERLI = 5,
  KOVAN = 42,

  // Polygon
  POLYGON = 137,
  POLYGON_MUMBAI = 80001,
  POLYGON_ZKEVM = 1101,

  // BSC
  BSC = 56,
  BSC_TESTNET = 97,

  // Optimism
  OPTIMISM = 10,
  OPTIMISM_TESTNET = 69,

  // Arbitrum One
  ARBITRUM = 42161,
  ARBITRUM_TESTNET = 421611,

  // Arbitrum Nova
  ARBITRUM_NOVA = 42170,

  // Avalanche
  AVALANCHE = 43114,
  AVALANCHE_TESTNET = 43113,

  // Fantom
  FANTOM = 250,
  FANTOM_TESTNET = 4002,

  // Gnosis Chain (XDAI)
  GNOSIS = 100,

  // AURORA
  AURORA = 1313161554,
  AURORA_TESTNET = 1313161556,

  // HARDHAT TESTNETS
  HARDHAT = 31337,
  HARDHAT_2 = 31338
}

export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet'
}

export interface NetworkConfig {
  chainId: number
  type: NetworkType

  title?: string
  name: string

  blockExplorer?: BlockExplorerConfig
  ensAddress?: string

  rpcUrl: string
  provider?: providers.Provider
  indexerUrl?: string
  indexer?: Indexer
  relayer?: Relayer | RpcRelayerOptions

  // isDefaultChain identifies the default network. For example, a dapp may run on the Polygon
  // network and may configure the wallet to use it as its main/default chain.
  isDefaultChain?: boolean

  // deprecated but retained for backwards compatibility
  isAuthChain?: boolean

  // Disabled / deprecated chain
  disabled?: boolean
}

export type BlockExplorerConfig = {
  name?: string
  rootUrl: string
  addressUrl?: string
  txnHashUrl?: string
}

export const indexerURL = (network: string) => stringTemplate('https://${network}-indexer.sequence.app', { network: network })
export const relayerURL = (network: string) => stringTemplate('https://${network}-relayer.sequence.app', { network: network })
export const nodesURL = (network: string) => stringTemplate('https://nodes.sequence.app/${network}', { network: network })

export const networks: Record<ChainId, Omit<NetworkConfig, 'rpcUrl'>> = {
  [ChainId.MAINNET]: {
    chainId: ChainId.MAINNET,
    type: NetworkType.MAINNET,
    name: 'mainnet',
    title: 'Ethereum',
    blockExplorer: {
      name: 'Etherscan',
      rootUrl: 'https://etherscan.io/'
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  [ChainId.ROPSTEN]: {
    chainId: ChainId.ROPSTEN,
    type: NetworkType.TESTNET,
    name: 'ropsten',
    title: 'Ropsten',
    blockExplorer: {
      name: 'Etherscan (Ropsten)',
      rootUrl: 'https://ropsten.etherscan.io/'
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  [ChainId.RINKEBY]: {
    chainId: ChainId.RINKEBY,
    type: NetworkType.TESTNET,
    name: 'rinkeby',
    title: 'Rinkeby',
    blockExplorer: {
      name: 'Etherscan (Rinkeby)',
      rootUrl: 'https://rinkeby.etherscan.io/'
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    disabled: true
  },
  [ChainId.GOERLI]: {
    chainId: ChainId.GOERLI,
    type: NetworkType.TESTNET,
    name: 'goerli',
    title: 'Goerli',
    blockExplorer: {
      name: 'Etherscan (Goerli)',
      rootUrl: 'https://goerli.etherscan.io/'
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  [ChainId.KOVAN]: {
    chainId: ChainId.KOVAN,
    type: NetworkType.TESTNET,
    name: 'kovan',
    title: 'Kovan',
    blockExplorer: {
      name: 'Etherscan (Kovan)',
      rootUrl: 'https://kovan.etherscan.io/'
    }
  },
  [ChainId.POLYGON]: {
    chainId: ChainId.POLYGON,
    type: NetworkType.MAINNET,
    name: 'polygon',
    title: 'Polygon',
    blockExplorer: {
      name: 'Polygonscan',
      rootUrl: 'https://polygonscan.com/'
    },
    // TODO: Remove default and auth chains from here
    isDefaultChain: true,
    isAuthChain: true
  },
  [ChainId.POLYGON_MUMBAI]: {
    chainId: ChainId.POLYGON_MUMBAI,
    type: NetworkType.TESTNET,
    name: 'mumbai',
    title: 'Polygon Mumbai',
    blockExplorer: {
      name: 'Polygonscan (Mumbai)',
      rootUrl: 'https://mumbai.polygonscan.com/'
    }
  },
  [ChainId.POLYGON_ZKEVM]: {
    chainId: ChainId.POLYGON_ZKEVM,
    type: NetworkType.MAINNET,
    name: 'polygon-zkevm',
    title: 'Polygon zkEVM',
    blockExplorer: {
      name: 'Polygonscan (zkEVM)',
      rootUrl: 'https://zkevm.polygonscan.com/'
    }
  },
  [ChainId.BSC]: {
    chainId: ChainId.BSC,
    type: NetworkType.MAINNET,
    name: 'bsc',
    title: 'BNB Smart Chain',
    blockExplorer: {
      name: 'BSCScan',
      rootUrl: 'https://bscscan.com/'
    }
  },
  [ChainId.BSC_TESTNET]: {
    chainId: ChainId.BSC_TESTNET,
    type: NetworkType.TESTNET,
    name: 'bsc-testnet',
    title: 'BNB Smart Chain Testnet',
    blockExplorer: {
      name: 'BSCScan (Testnet)',
      rootUrl: 'https://testnet.bscscan.com/'
    }
  },
  [ChainId.OPTIMISM]: {
    chainId: ChainId.OPTIMISM,
    type: NetworkType.MAINNET,
    name: 'optimism',
    title: 'Optimism',
    blockExplorer: {
      name: 'Etherscan (Optimism)',
      rootUrl: 'https://optimistic.etherscan.io/'
    }
  },
  [ChainId.OPTIMISM_TESTNET]: {
    chainId: ChainId.OPTIMISM_TESTNET,
    type: NetworkType.TESTNET,
    name: 'optimism-testnet',
    title: 'Optimistic Kovan',
    blockExplorer: {
      name: 'Etherscan (Optimism Testnet)',
      rootUrl: 'https://kovan-optimistic.etherscan.io/'
    }
  },
  [ChainId.ARBITRUM]: {
    chainId: ChainId.ARBITRUM,
    type: NetworkType.MAINNET,
    name: 'arbitrum',
    title: 'Arbitrum One',
    blockExplorer: {
      name: 'Arbiscan',
      rootUrl: 'https://arbiscan.io/'
    }
  },
  [ChainId.ARBITRUM_TESTNET]: {
    chainId: ChainId.ARBITRUM_TESTNET,
    type: NetworkType.TESTNET,
    name: 'arbitrum-testnet',
    title: 'Arbitrum Testnet',
    blockExplorer: {
      name: 'Arbiscan (Testnet)',
      rootUrl: 'https://testnet.arbiscan.io/'
    }
  },
  [ChainId.ARBITRUM_NOVA]: {
    chainId: ChainId.ARBITRUM_NOVA,
    type: NetworkType.MAINNET,
    name: 'arbitrum-nova',
    title: 'Arbitrum Nova',
    blockExplorer: {
      name: 'Nova Explorer',
      rootUrl: 'https://nova-explorer.arbitrum.io/'
    }
  },
  [ChainId.AVALANCHE]: {
    chainId: ChainId.AVALANCHE,
    type: NetworkType.MAINNET,
    name: 'avalanche',
    title: 'Avalanche',
    blockExplorer: {
      name: 'Snowtrace',
      rootUrl: 'https://snowtrace.io/'
    }
  },
  [ChainId.AVALANCHE_TESTNET]: {
    chainId: ChainId.AVALANCHE_TESTNET,
    type: NetworkType.TESTNET,
    name: 'avalanche-testnet',
    title: 'Avalanche Testnet',
    blockExplorer: {
      name: 'Snowtrace (Testnet)',
      rootUrl: 'https://testnet.snowtrace.io/'
    }
  },
  [ChainId.FANTOM]: {
    chainId: ChainId.FANTOM,
    type: NetworkType.MAINNET,
    name: 'fantom',
    title: 'Fantom',
    blockExplorer: {
      name: 'FTMScan',
      rootUrl: 'https://ftmscan.com/'
    }
  },
  [ChainId.FANTOM_TESTNET]: {
    chainId: ChainId.FANTOM_TESTNET,
    type: NetworkType.TESTNET,
    name: 'fantom-testnet',
    title: 'Fantom Testnet',
    blockExplorer: {
      name: 'FTMScan (Testnet)',
      rootUrl: 'https://testnet.ftmscan.com/'
    }
  },
  [ChainId.GNOSIS]: {
    chainId: ChainId.GNOSIS,
    type: NetworkType.MAINNET,
    name: 'gnosis',
    title: 'Gnosis Chain',
    blockExplorer: {
      name: 'Gnosis Chain Explorer',
      rootUrl: 'https://blockscout.com/xdai/mainnet/'
    }
  },
  [ChainId.AURORA]: {
    chainId: ChainId.AURORA,
    type: NetworkType.MAINNET,
    name: 'aurora',
    title: 'Aurora',
    blockExplorer: {
      name: 'Aurora Explorer',
      rootUrl: 'https://aurorascan.dev/'
    }
  },
  [ChainId.AURORA_TESTNET]: {
    chainId: ChainId.AURORA_TESTNET,
    type: NetworkType.TESTNET,
    name: 'aurora-testnet',
    title: 'Aurora Testnet',
    blockExplorer: {
      name: 'Aurora Explorer (Testnet)',
      rootUrl: 'https://testnet.aurorascan.dev/'
    }
  },
  [ChainId.HARDHAT]: {
    chainId: ChainId.HARDHAT,
    type: NetworkType.TESTNET,
    name: 'hardhat',
    title: 'Hardhat (local testnet)'
  },
  [ChainId.HARDHAT_2]: {
    chainId: ChainId.HARDHAT_2,
    type: NetworkType.TESTNET,
    name: 'hardhat2',
    title: 'Hardhat (local testnet)'
  }
}

export function findSupportedNetwork(chainIdOrName: string | ChainIdLike): NetworkConfig | undefined {
  return findNetworkConfig(allNetworks, chainIdOrName)
}

export type ChainIdLike = NetworkConfig | BigNumberish

const genUrls = (network: string) => {
  const rpcUrl = nodesURL(network)
  return {
    rpcUrl,
    relayer: {
      url: relayerURL(rpcUrl),
      provider: {
        url: rpcUrl
      }
    },
    indexerUrl: indexerURL(network)
  }
}

export const allNetworks = validateAndSortNetworks([
  {
    ...networks[ChainId.MAINNET],
    ...genUrls('mainnet')
  },
  {
    ...networks[ChainId.POLYGON],
    ...genUrls('polygon')
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
    ...networks[ChainId.POLYGON_ZKEVM],
    ...genUrls('polygon-zkevm')
  },
  {
    ...networks[ChainId.GNOSIS],
    ...genUrls('gnosis')
  },
  {
    ...networks[ChainId.RINKEBY],
    ...genUrls('rinkeby')
  },
  {
    ...networks[ChainId.GOERLI],
    ...genUrls('goerli')
  },
  {
    ...networks[ChainId.POLYGON_MUMBAI],
    ...genUrls('mumbai')
  },
  {
    ...networks[ChainId.BSC_TESTNET],
    ...genUrls('bsc-testnet')
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
