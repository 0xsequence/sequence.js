import { BigNumberish, providers } from 'ethers'
import { Indexer } from '@0xsequence/indexer'
import { Relayer, RpcRelayerOptions } from '@0xsequence/relayer'
import { stringTemplate, validateAndSortNetworks } from './utils'

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
  ARBITRUM_GOERLI = 421613,

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

  // BASE
  BASE_GOERLI = 84531
}

export interface NetworkConfig {
  title?: string
  name: string
  chainId: number
  testnet?: boolean

  blockExplorer?: BlockExplorerConfig
  ensAddress?: string

  rpcUrl?: string
  provider?: providers.JsonRpcProvider
  indexerUrl?: string
  indexer?: Indexer
  relayer?: Relayer | RpcRelayerOptions

  // isDefaultChain identifies the default network. For example, a dapp may run on the Polygon
  // network and may configure the wallet to use it as its main/default chain.
  isDefaultChain?: boolean

  // isAuthChain identifies the network containing wallet config contents.
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

export const networks: Record<ChainId, NetworkConfig> = {
  [ChainId.MAINNET]: {
    chainId: ChainId.MAINNET,
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
    name: 'ropsten',
    title: 'Ropsten',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Ropsten)',
      rootUrl: 'https://ropsten.etherscan.io/'
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  [ChainId.RINKEBY]: {
    chainId: ChainId.RINKEBY,
    name: 'rinkeby',
    title: 'Rinkeby',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Rinkeby)',
      rootUrl: 'https://rinkeby.etherscan.io/'
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    disabled: true
  },
  [ChainId.GOERLI]: {
    chainId: ChainId.GOERLI,
    name: 'goerli',
    title: 'Goerli',
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Goerli)',
      rootUrl: 'https://goerli.etherscan.io/'
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
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
  [ChainId.POLYGON_ZKEVM]: {
    chainId: ChainId.POLYGON_ZKEVM,
    name: 'polygon-zkevm',
    title: 'Polygon zkEVM',
    blockExplorer: {
      name: 'Polygonscan (zkEVM)',
      rootUrl: 'https://zkevm.polygonscan.com/'
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
    title: 'Arbitrum One',
    blockExplorer: {
      name: 'Arbiscan',
      rootUrl: 'https://arbiscan.io/'
    }
  },
  [ChainId.ARBITRUM_GOERLI]: {
    chainId: ChainId.ARBITRUM_GOERLI,
    name: 'arbitrum-goerli',
    title: 'Arbitrum Goerli',
    testnet: true,
    blockExplorer: {
      name: 'Arbiscan (Testnet)',
      rootUrl: 'https://testnet.arbiscan.io/'
    }
  },
  [ChainId.ARBITRUM_NOVA]: {
    chainId: ChainId.ARBITRUM_NOVA,
    name: 'arbitrum-nova',
    title: 'Arbitrum Nova',
    blockExplorer: {
      name: 'Nova Explorer',
      rootUrl: 'https://nova-explorer.arbitrum.io/'
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
  },
  [ChainId.BASE_GOERLI]: {
    chainId: ChainId.BASE_GOERLI,
    name: 'base-goerli',
    title: 'Base Goerli',
    blockExplorer: {
      name: 'Base Goerli Explorer',
      rootUrl: 'https://goerli.basescan.org/'
    }
  }
}

export type ChainIdLike = NetworkConfig | BigNumberish

export const mainnetNetworks = validateAndSortNetworks([
  {
    ...networks[ChainId.MAINNET],
    rpcUrl: nodesURL('mainnet'),
    relayer: { url: relayerURL('mainnet') },
    indexerUrl: indexerURL('mainnet')
  },
  {
    ...networks[ChainId.POLYGON],
    rpcUrl: nodesURL('polygon'),
    relayer: { url: relayerURL('polygon') },
    indexerUrl: indexerURL('polygon'),
    isDefaultChain: true,
    isAuthChain: true
  },
  {
    ...networks[ChainId.BSC],
    rpcUrl: nodesURL('bsc'),
    indexerUrl: indexerURL('bsc'),
    relayer: { url: relayerURL('bsc') }
  },
  {
    ...networks[ChainId.AVALANCHE],
    rpcUrl: nodesURL('avalanche'),
    indexerUrl: indexerURL('avalanche'),
    relayer: { url: relayerURL('avalanche') }
  },
  {
    ...networks[ChainId.ARBITRUM],
    rpcUrl: nodesURL('arbitrum'),
    indexerUrl: indexerURL('arbitrum'),
    relayer: { url: relayerURL('arbitrum') }
  },
  {
    ...networks[ChainId.ARBITRUM_NOVA],
    rpcUrl: nodesURL('arbitrum-nova'),
    indexerUrl: indexerURL('arbitrum-nova'),
    relayer: { url: relayerURL('arbitrum-nova') }
  },
  {
    ...networks[ChainId.OPTIMISM],
    rpcUrl: nodesURL('optimism'),
    indexerUrl: indexerURL('optimism'),
    relayer: { url: relayerURL('optimism') }
  },
  {
    ...networks[ChainId.POLYGON_ZKEVM],
    rpcUrl: nodesURL('polygon-zkevm'),
    indexerUrl: indexerURL('polygon-zkevm'),
    relayer: { url: relayerURL('polygon-zkevm') }
  },
  {
    ...networks[ChainId.GNOSIS],
    rpcUrl: nodesURL('gnosis'),
    indexerUrl: indexerURL('gnosis'),
    relayer: { url: relayerURL('gnosis') }
  }
])

export const testnetNetworks = validateAndSortNetworks([
  {
    ...networks[ChainId.RINKEBY],
    rpcUrl: nodesURL('rinkeby'),
    relayer: { url: relayerURL('rinkeby') },
    indexerUrl: indexerURL('rinkeby')
  },
  {
    ...networks[ChainId.GOERLI],
    rpcUrl: nodesURL('goerli'),
    relayer: { url: relayerURL('goerli') },
    indexerUrl: indexerURL('goerli')
  },
  {
    ...networks[ChainId.POLYGON_MUMBAI],
    rpcUrl: nodesURL('mumbai'),
    relayer: { url: relayerURL('mumbai') },
    indexerUrl: indexerURL('mumbai'),
    isDefaultChain: true,
    isAuthChain: true
  },
  {
    ...networks[ChainId.BSC_TESTNET],
    rpcUrl: nodesURL('bsc-testnet'),
    relayer: { url: relayerURL('bsc-testnet') },
    indexerUrl: indexerURL('bsc-testnet')
  },
  {
    ...networks[ChainId.ARBITRUM_GOERLI],
    rpcUrl: nodesURL('arbitrum-goerli'),
    relayer: { url: relayerURL('arbitrum-goerli') },
    indexerUrl: indexerURL('arbitrum-goerli')
  },
  {
    ...networks[ChainId.BASE_GOERLI],
    rpcUrl: nodesURL('base-goerli'),
    relayer: { url: relayerURL('base-goerli') },
    indexerUrl: indexerURL('base-goerli')
  }
])
