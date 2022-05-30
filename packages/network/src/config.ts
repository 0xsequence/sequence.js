import { BigNumberish } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Indexer } from '@0xsequence/indexer'
import { Relayer, RpcRelayerOptions } from '@0xsequence/relayer'
import { urlClean } from '@0xsequence/utils'
import { createNetworkConfig } from './utils'

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

  // BSC
  BSC = 56,
  BSC_TESTNET = 97,

  // Optimism
  OPTIMISM = 10,
  OPTIMISM_TESTNET = 69,

  // Arbitrum
  ARBITRUM = 42161,
  ARBITRUM_TESTNET = 421611,

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
  AURORA_TESTNET = 1313161556
}

export interface NetworkConfig {
  title?: string
  name: string
  chainId: number
  ensAddress?: string
  testnet?: boolean

  blockExplorer?: BlockExplorerConfig

  rpcUrl?: string
  provider?: JsonRpcProvider
  indexerUrl?: string
  indexer?: Indexer
  relayer?: Relayer | RpcRelayerOptions

  // isDefaultChain identifies the default network. For example, a dapp may run on the Polygon
  // network and may configure the wallet to use it as its main/default chain.
  isDefaultChain?: boolean

  // isAuthChain identifies the network containing wallet config contents.
  isAuthChain?: boolean
}

export type BlockExplorerConfig = {
  name?: string
  rootUrl: string
  addressUrl?: string
  txnHashUrl?: string
}

export const networks: Record<ChainId, NetworkConfig> = {
  [ChainId.MAINNET]: {
    chainId: ChainId.MAINNET,
    name: 'mainnet',
    title: 'Ethereum',
    blockExplorer: {
      name: 'Etherscan',
      rootUrl: 'https://etherscan.io/'
    }
  },
  [ChainId.ROPSTEN]: {
    chainId: ChainId.ROPSTEN,
    name: 'ropsten',
    title: 'Ropsten',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Ropsten)',
      rootUrl: 'https://ropsten.etherscan.io/'
    }
  },
  [ChainId.RINKEBY]: {
    chainId: ChainId.RINKEBY,
    name: 'rinkeby',
    title: 'Rinkeby',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Rinkeby)',
      rootUrl: 'https://rinkeby.etherscan.io/'
    }
  },
  [ChainId.GOERLI]: {
    chainId: ChainId.GOERLI,
    name: 'goerli',
    title: 'Goerli',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Goerli)',
      rootUrl: 'https://goerli.etherscan.io/'
    }
  },
  [ChainId.KOVAN]: {
    chainId: ChainId.KOVAN,
    name: 'kovan',
    title: 'Kovan',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Kovan)',
      rootUrl: 'https://kovan.etherscan.io/'
    }
  },
  [ChainId.POLYGON]: {
    chainId: ChainId.POLYGON,
    name: 'polygon',
    title: 'Polygon',
    blockExplorer: {
      name: 'Polygonscan',
      rootUrl: 'https://polygonscan.com/'
    }
  },
  [ChainId.POLYGON_MUMBAI]: {
    chainId: ChainId.POLYGON_MUMBAI,
    name: 'mumbai',
    title: 'Polygon Mumbai',
    testnet: true,
    blockExplorer: {
      name: 'Polygonscan (Mumbai)',
      rootUrl: 'https://mumbai.polygonscan.com/'
    }
  },
  [ChainId.BSC]: {
    chainId: ChainId.BSC,
    name: 'bsc',
    title: 'BNB Smart Chain',
    blockExplorer: {
      name: 'BSCScan',
      rootUrl: 'https://bscscan.com/'
    }
  },
  [ChainId.BSC_TESTNET]: {
    chainId: ChainId.BSC_TESTNET,
    name: 'bsc-testnet',
    title: 'BNB Smart Chain Testnet',
    testnet: true,
    blockExplorer: {
      name: 'BSCScan (Testnet)',
      rootUrl: 'https://testnet.bscscan.com/'
    }
  },
  [ChainId.OPTIMISM]: {
    chainId: ChainId.OPTIMISM,
    name: 'optimism',
    title: 'Optimism',
    blockExplorer: {
      name: 'Etherscan (Optimism)',
      rootUrl: 'https://optimistic.etherscan.io/'
    }
  },
  [ChainId.OPTIMISM_TESTNET]: {
    chainId: ChainId.OPTIMISM_TESTNET,
    name: 'optimism-testnet',
    title: 'Optimistic Kovan',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Optimism Testnet)',
      rootUrl: 'https://kovan-optimistic.etherscan.io/'
    }
  },
  [ChainId.ARBITRUM]: {
    chainId: ChainId.ARBITRUM,
    name: 'arbitrum',
    title: 'Arbitrum',
    blockExplorer: {
      name: 'Arbiscan',
      rootUrl: 'https://arbiscan.io/'
    }
  },
  [ChainId.ARBITRUM_TESTNET]: {
    chainId: ChainId.ARBITRUM_TESTNET,
    name: 'arbitrum-testnet',
    title: 'Arbitrum Testnet',
    testnet: true,
    blockExplorer: {
      name: 'Arbiscan (Testnet)',
      rootUrl: 'https://testnet.arbiscan.io/'
    }
  },
  [ChainId.AVALANCHE]: {
    chainId: ChainId.AVALANCHE,
    name: 'avalanche',
    title: 'Avalanche',
    blockExplorer: {
      name: 'Snowtrace',
      rootUrl: 'https://snowtrace.io/'
    }
  },
  [ChainId.AVALANCHE_TESTNET]: {
    chainId: ChainId.AVALANCHE_TESTNET,
    name: 'avalanche-testnet',
    title: 'Avalanche Testnet',
    testnet: true,
    blockExplorer: {
      name: 'Snowtrace (Testnet)',
      rootUrl: 'https://testnet.snowtrace.io/'
    }
  },
  [ChainId.FANTOM]: {
    chainId: ChainId.FANTOM,
    name: 'fantom',
    title: 'Fantom',
    blockExplorer: {
      name: 'FTMScan',
      rootUrl: 'https://ftmscan.com/'
    }
  },
  [ChainId.FANTOM_TESTNET]: {
    chainId: ChainId.FANTOM_TESTNET,
    name: 'fantom-testnet',
    title: 'Fantom Testnet',
    testnet: true,
    blockExplorer: {
      name: 'FTMScan (Testnet)',
      rootUrl: 'https://testnet.ftmscan.com/'
    }
  },
  [ChainId.GNOSIS]: {
    chainId: ChainId.GNOSIS,
    name: 'gnosis',
    title: 'Gnosis Chain',
    blockExplorer: {
      name: 'Gnosis Chain Explorer',
      rootUrl: 'https://blockscout.com/xdai/mainnet/'
    }
  },
  [ChainId.AURORA]: {
    chainId: ChainId.AURORA,
    name: 'aurora',
    title: 'Aurora',
    blockExplorer: {
      name: 'Aurora Explorer',
      rootUrl: 'https://aurorascan.dev/'
    }
  },
  [ChainId.AURORA_TESTNET]: {
    chainId: ChainId.AURORA_TESTNET,
    name: 'aurora-testnet',
    title: 'Aurora Testnet',
    blockExplorer: {
      name: 'Aurora Explorer (Testnet)',
      rootUrl: 'https://testnet.aurorascan.dev/'
    }
  }
}

export type ChainIdLike = NetworkConfig | BigNumberish

export type NetworksBuilder = (vars: { [key: string]: any }) => NetworkConfig[]

export const mainnetNetworks = createNetworkConfig(
  (vars: { [key: string]: any }) => [
    {
      ...networks[ChainId.MAINNET],
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: urlClean(`${vars.baseRpcUrl}/mainnet`),
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/mainnet`) },
      isDefaultChain: true
    },
    {
      ...networks[ChainId.POLYGON],
      rpcUrl: 'https://rpc-mainnet.matic.network',
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/matic`) },
      isAuthChain: true
    }
  ],
  1,
  {
    baseRpcUrl: 'https://nodes.sequence.app',
    baseRelayerUrl: 'https://relayers.sequence.app'
  }
)

export const testnetNetworks = createNetworkConfig(
  (vars: { [key: string]: any }) => [
    {
      ...networks[ChainId.RINKEBY],
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: urlClean(`${vars.baseRpcUrl}/rinkeby`),
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/rinkeby`) },
      isDefaultChain: true
    },
    {
      ...networks[ChainId.GOERLI],
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: urlClean(`${vars.baseRpcUrl}/goerli`),
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/goerli`) },
      isAuthChain: true
    }
  ],
  undefined,
  {
    baseRpcUrl: 'https://nodes.sequence.app',
    baseRelayerUrl: 'https://relayers.sequence.app'
  }
)
