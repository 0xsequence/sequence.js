export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

export type BlockExplorerConfig = {
  name?: string
  url: string
}

export interface Network {
  chainId: number
  type: NetworkType
  name: string
  title?: string
  rpcUrl: string
  logoUrl?: string
  blockExplorer?: BlockExplorerConfig
  nativeCurrency: {
    symbol: string
    name: string
    decimals: number
  }
  ensAddress?: string
  deprecated?: true
}

export const ChainId = {
  NONE: 0,

  // Ethereum
  MAINNET: 1,
  SEPOLIA: 11155111,

  // Polygon
  POLYGON: 137,
  POLYGON_ZKEVM: 1101,
  POLYGON_AMOY: 80002,

  // BSC
  BSC: 56,
  BSC_TESTNET: 97,

  // Optimism
  OPTIMISM: 10,
  OPTIMISM_SEPOLIA: 11155420,

  // Arbitrum One
  ARBITRUM: 42161,
  ARBITRUM_SEPOLIA: 421614,

  // Arbitrum Nova
  ARBITRUM_NOVA: 42170,

  // Avalanche
  AVALANCHE: 43114,
  AVALANCHE_TESTNET: 43113,

  // Gnosis Chain (XDAI)
  GNOSIS: 100,

  // BASE
  BASE: 8453,
  BASE_SEPOLIA: 84532,

  // HOMEVERSE
  HOMEVERSE_TESTNET: 40875,
  HOMEVERSE: 19011,

  // Xai
  XAI: 660279,
  XAI_SEPOLIA: 37714555429,

  // TELOS
  TELOS: 40,
  TELOS_TESTNET: 41,

  // B3 Sepolia
  B3: 8333,
  B3_SEPOLIA: 1993,

  // APE Chain
  APECHAIN: 33139,
  APECHAIN_TESTNET: 33111,

  // Blast
  BLAST: 81457,
  BLAST_SEPOLIA: 168587773,

  // SKALE Nebula
  SKALE_NEBULA: 1482601649,
  SKALE_NEBULA_TESTNET: 37084624,

  // Soneium Minato
  SONEIUM_MINATO: 1946,
  SONEIUM: 1868,

  // TOY Testnet
  TOY_TESTNET: 21000000,

  // Immutable zkEVM
  IMMUTABLE_ZKEVM: 13371,
  IMMUTABLE_ZKEVM_TESTNET: 13473,

  // ETHERLINK
  ETHERLINK: 42793,
  ETHERLINK_TESTNET: 128123,

  // MOONBEAM
  MOONBEAM: 1284,
  MOONBASE_ALPHA: 1287,

  // MONAD
  MONAD: 143,
  MONAD_TESTNET: 10143,

  // SOMNIA
  SOMNIA_TESTNET: 50312,
  SOMNIA: 5031,

  // INCENTIV
  INCENTIV_TESTNET_V2: 28802,

  // KATANA
  KATANA: 747474,

  // SANDBOX
  SANDBOX_TESTNET: 6252,

  // ARC
  ARC_TESTNET: 5042002,
} as const

export type ChainId = (typeof ChainId)[keyof typeof ChainId]

export const ALL: Network[] = [
  {
    chainId: ChainId.MAINNET,
    type: NetworkType.MAINNET,
    name: 'mainnet',
    title: 'Ethereum',
    rpcUrl: getRpcUrl('mainnet'),
    logoUrl: getLogoUrl(ChainId.MAINNET),
    blockExplorer: {
      name: 'Etherscan',
      url: 'https://etherscan.io/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  },
  {
    chainId: ChainId.SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'sepolia',
    title: 'Sepolia',
    rpcUrl: getRpcUrl('sepolia'),
    logoUrl: getLogoUrl(ChainId.SEPOLIA),
    blockExplorer: {
      name: 'Etherscan (Sepolia)',
      url: 'https://sepolia.etherscan.io/',
    },
    nativeCurrency: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.POLYGON,
    type: NetworkType.MAINNET,
    name: 'polygon',
    title: 'Polygon',
    rpcUrl: getRpcUrl('polygon'),
    logoUrl: getLogoUrl(ChainId.POLYGON),
    blockExplorer: {
      name: 'Polygonscan',
      url: 'https://polygonscan.com/',
    },
    nativeCurrency: {
      symbol: 'POL',
      name: 'POL',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.POLYGON_AMOY,
    type: NetworkType.TESTNET,
    name: 'amoy',
    title: 'Polygon Amoy',
    rpcUrl: getRpcUrl('amoy'),
    logoUrl: getLogoUrl(ChainId.POLYGON_AMOY),
    blockExplorer: {
      name: 'OKLink (Amoy)',
      url: 'https://www.oklink.com/amoy/',
    },
    nativeCurrency: {
      symbol: 'aPOL',
      name: 'Amoy POL',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.POLYGON_ZKEVM,
    type: NetworkType.MAINNET,
    name: 'polygon-zkevm',
    title: 'Polygon zkEVM',
    rpcUrl: getRpcUrl('polygon-zkevm'),
    logoUrl: getLogoUrl(ChainId.POLYGON_ZKEVM),
    blockExplorer: {
      name: 'Polygonscan (zkEVM)',
      url: 'https://zkevm.polygonscan.com/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BSC,
    type: NetworkType.MAINNET,
    name: 'bsc',
    title: 'BNB Smart Chain',
    rpcUrl: getRpcUrl('bsc'),
    logoUrl: getLogoUrl(ChainId.BSC),
    blockExplorer: {
      name: 'BSCScan',
      url: 'https://bscscan.com/',
    },
    nativeCurrency: {
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BSC_TESTNET,
    type: NetworkType.TESTNET,
    name: 'bsc-testnet',
    title: 'BNB Smart Chain Testnet',
    rpcUrl: getRpcUrl('bsc-testnet'),
    logoUrl: getLogoUrl(ChainId.BSC_TESTNET),
    blockExplorer: {
      name: 'BSCScan (Testnet)',
      url: 'https://testnet.bscscan.com/',
    },
    nativeCurrency: {
      symbol: 'tBNB',
      name: 'Testnet BNB',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.OPTIMISM,
    type: NetworkType.MAINNET,
    name: 'optimism',
    title: 'Optimism',
    rpcUrl: getRpcUrl('optimism'),
    logoUrl: getLogoUrl(ChainId.OPTIMISM),
    blockExplorer: {
      name: 'Etherscan (Optimism)',
      url: 'https://optimistic.etherscan.io/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.OPTIMISM_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'optimism-sepolia',
    title: 'Optimism Sepolia',
    rpcUrl: getRpcUrl('optimism-sepolia'),
    logoUrl: getLogoUrl(ChainId.OPTIMISM_SEPOLIA),
    blockExplorer: {
      name: 'Etherscan (Optimism Sepolia)',
      url: 'https://sepolia-optimistic.etherscan.io/',
    },
    nativeCurrency: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ARBITRUM,
    type: NetworkType.MAINNET,
    name: 'arbitrum',
    title: 'Arbitrum One',
    rpcUrl: getRpcUrl('arbitrum'),
    logoUrl: getLogoUrl(ChainId.ARBITRUM),
    blockExplorer: {
      name: 'Arbiscan',
      url: 'https://arbiscan.io/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ARBITRUM_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'arbitrum-sepolia',
    title: 'Arbitrum Sepolia',
    rpcUrl: getRpcUrl('arbitrum-sepolia'),
    logoUrl: getLogoUrl(ChainId.ARBITRUM_SEPOLIA),
    blockExplorer: {
      name: 'Arbiscan (Sepolia Testnet)',
      url: 'https://sepolia.arbiscan.io/',
    },
    nativeCurrency: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ARBITRUM_NOVA,
    type: NetworkType.MAINNET,
    name: 'arbitrum-nova',
    title: 'Arbitrum Nova',
    rpcUrl: getRpcUrl('arbitrum-nova'),
    logoUrl: getLogoUrl(ChainId.ARBITRUM_NOVA),
    blockExplorer: {
      name: 'Arbiscan Nova',
      url: 'https://nova.arbiscan.io/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.AVALANCHE,
    type: NetworkType.MAINNET,
    name: 'avalanche',
    title: 'Avalanche',
    rpcUrl: getRpcUrl('avalanche'),
    logoUrl: getLogoUrl(ChainId.AVALANCHE),
    blockExplorer: {
      name: 'Snowtrace',
      url: 'https://subnets.avax.network/c-chain/',
    },
    nativeCurrency: {
      symbol: 'AVAX',
      name: 'AVAX',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.AVALANCHE_TESTNET,
    type: NetworkType.TESTNET,
    name: 'avalanche-testnet',
    title: 'Avalanche Testnet',
    rpcUrl: getRpcUrl('avalanche-testnet'),
    logoUrl: getLogoUrl(ChainId.AVALANCHE_TESTNET),
    blockExplorer: {
      name: 'Snowtrace (Testnet)',
      url: 'https://subnets-test.avax.network/c-chain/',
    },
    nativeCurrency: {
      symbol: 'tAVAX',
      name: 'Testnet AVAX',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.GNOSIS,
    type: NetworkType.MAINNET,
    name: 'gnosis',
    title: 'Gnosis Chain',
    rpcUrl: getRpcUrl('gnosis'),
    logoUrl: getLogoUrl(ChainId.GNOSIS),
    blockExplorer: {
      name: 'Gnosis Chain Explorer',
      url: 'https://blockscout.com/xdai/mainnet/',
    },
    nativeCurrency: {
      symbol: 'XDAI',
      name: 'XDAI',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BASE,
    type: NetworkType.MAINNET,
    name: 'base',
    title: 'Base (Coinbase)',
    rpcUrl: getRpcUrl('base'),
    logoUrl: getLogoUrl(ChainId.BASE),
    blockExplorer: {
      name: 'Base Explorer',
      url: 'https://basescan.org/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BASE_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'base-sepolia',
    title: 'Base Sepolia',
    rpcUrl: getRpcUrl('base-sepolia'),
    logoUrl: getLogoUrl(ChainId.BASE_SEPOLIA),
    blockExplorer: {
      name: 'Base Sepolia Explorer',
      url: 'https://base-sepolia.blockscout.com/',
    },
    nativeCurrency: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.HOMEVERSE,
    type: NetworkType.MAINNET,
    name: 'homeverse',
    title: 'Oasys Homeverse',
    rpcUrl: getRpcUrl('homeverse'),
    logoUrl: getLogoUrl(ChainId.HOMEVERSE),
    blockExplorer: {
      name: 'Oasys Homeverse Explorer',
      url: 'https://explorer.oasys.homeverse.games/',
    },
    nativeCurrency: {
      symbol: 'OAS',
      name: 'OAS',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.HOMEVERSE_TESTNET,
    type: NetworkType.TESTNET,
    name: 'homeverse-testnet',
    title: 'Oasys Homeverse Testnet',
    rpcUrl: getRpcUrl('homeverse-testnet'),
    logoUrl: getLogoUrl(ChainId.HOMEVERSE_TESTNET),
    blockExplorer: {
      name: 'Oasys Homeverse Explorer (Testnet)',
      url: 'https://explorer.testnet.oasys.homeverse.games/',
    },
    nativeCurrency: {
      symbol: 'tOAS',
      name: 'Testnet OAS',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.XAI,
    type: NetworkType.MAINNET,
    name: 'xai',
    title: 'Xai',
    rpcUrl: getRpcUrl('xai'),
    logoUrl: getLogoUrl(ChainId.XAI),
    blockExplorer: {
      name: 'Xai Explorer',
      url: 'https://explorer.xai-chain.net/',
    },
    nativeCurrency: {
      symbol: 'XAI',
      name: 'XAI',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.XAI_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'xai-sepolia',
    title: 'Xai Sepolia',
    rpcUrl: getRpcUrl('xai-sepolia'),
    logoUrl: getLogoUrl(ChainId.XAI_SEPOLIA),
    blockExplorer: {
      name: 'Xai Sepolia Explorer',
      url: 'https://testnet-explorer-v2.xai-chain.net/',
    },
    nativeCurrency: {
      symbol: 'sXAI',
      name: 'Sepolia XAI',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.B3,
    type: NetworkType.MAINNET,
    name: 'b3',
    title: 'B3',
    rpcUrl: getRpcUrl('b3'),
    logoUrl: getLogoUrl(ChainId.B3),
    blockExplorer: {
      name: 'B3 Explorer',
      url: 'https://explorer.b3.fun/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.B3_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'b3-sepolia',
    title: 'B3 Sepolia',
    rpcUrl: getRpcUrl('b3-sepolia'),
    logoUrl: getLogoUrl(ChainId.B3_SEPOLIA),
    blockExplorer: {
      name: 'B3 Sepolia Explorer',
      url: 'https://sepolia.explorer.b3.fun/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.APECHAIN,
    type: NetworkType.MAINNET,
    name: 'apechain',
    title: 'APE Chain',
    rpcUrl: getRpcUrl('apechain'),
    logoUrl: getLogoUrl(ChainId.APECHAIN),
    blockExplorer: {
      name: 'APE Chain Explorer',
      url: 'https://apechain.calderaexplorer.xyz/',
    },
    nativeCurrency: {
      symbol: 'APE',
      name: 'ApeCoin',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.APECHAIN_TESTNET,
    type: NetworkType.TESTNET,
    name: 'apechain-testnet',
    title: 'APE Chain Testnet',
    rpcUrl: getRpcUrl('apechain-testnet'),
    logoUrl: getLogoUrl(ChainId.APECHAIN_TESTNET),
    blockExplorer: {
      name: 'APE Chain Explorer',
      url: 'https://curtis.explorer.caldera.xyz/',
    },
    nativeCurrency: {
      symbol: 'APE',
      name: 'ApeCoin',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BLAST,
    type: NetworkType.MAINNET,
    name: 'blast',
    title: 'Blast',
    rpcUrl: getRpcUrl('blast'),
    logoUrl: getLogoUrl(ChainId.BLAST),
    blockExplorer: {
      name: 'Blast Explorer',
      url: 'https://blastscan.io/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BLAST_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'blast-sepolia',
    title: 'Blast Sepolia',
    rpcUrl: getRpcUrl('blast-sepolia'),
    logoUrl: getLogoUrl(ChainId.BLAST_SEPOLIA),
    blockExplorer: {
      name: 'Blast Sepolia Explorer',
      url: 'https://sepolia.blastexplorer.io/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.TELOS,
    type: NetworkType.MAINNET,
    name: 'telos',
    title: 'Telos',
    rpcUrl: getRpcUrl('telos'),
    logoUrl: getLogoUrl(ChainId.TELOS),
    blockExplorer: {
      name: 'Telos Explorer',
      url: 'https://explorer.telos.net/network/',
    },
    nativeCurrency: {
      symbol: 'TLOS',
      name: 'TLOS',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.TELOS_TESTNET,
    type: NetworkType.TESTNET,
    name: 'telos-testnet',
    title: 'Telos Testnet',
    rpcUrl: getRpcUrl('telos-testnet'),
    logoUrl: getLogoUrl(ChainId.TELOS_TESTNET),
    blockExplorer: {
      name: 'Telos Testnet Explorer',
      url: 'https://explorer-test.telos.net/network',
    },
    nativeCurrency: {
      symbol: 'TLOS',
      name: 'TLOS',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.SKALE_NEBULA,
    type: NetworkType.MAINNET,
    name: 'skale-nebula',
    title: 'SKALE Nebula Gaming Hub',
    rpcUrl: getRpcUrl('skale-nebula'),
    logoUrl: getLogoUrl(ChainId.SKALE_NEBULA),
    blockExplorer: {
      name: 'SKALE Nebula Gaming Hub Explorer',
      url: 'https://green-giddy-denebola.explorer.mainnet.skalenodes.com/',
    },
    nativeCurrency: {
      symbol: 'sFUEL',
      name: 'SKALE Fuel',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.SKALE_NEBULA_TESTNET,
    type: NetworkType.TESTNET,
    name: 'skale-nebula-testnet',
    title: 'SKALE Nebula Gaming Hub Testnet',
    rpcUrl: getRpcUrl('skale-nebula-testnet'),
    logoUrl: getLogoUrl(ChainId.SKALE_NEBULA_TESTNET),
    blockExplorer: {
      name: 'SKALE Nebula Gaming Hub Testnet Explorer',
      url: 'https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com/',
    },
    nativeCurrency: {
      symbol: 'sFUEL',
      name: 'SKALE Fuel',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.SONEIUM,
    type: NetworkType.MAINNET,
    name: 'soneium',
    title: 'Soneium',
    rpcUrl: getRpcUrl('soneium'),
    logoUrl: getLogoUrl(ChainId.SONEIUM),
    blockExplorer: {
      name: 'Soneium Explorer',
      url: 'https://soneium.blockscout.com/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.SONEIUM_MINATO,
    type: NetworkType.TESTNET,
    name: 'soneium-minato',
    title: 'Soneium Minato (Testnet)',
    rpcUrl: getRpcUrl('soneium-minato'),
    logoUrl: getLogoUrl(ChainId.SONEIUM_MINATO),
    blockExplorer: {
      name: 'Soneium Minato Explorer',
      url: 'https://explorer-testnet.soneium.org/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.TOY_TESTNET,
    type: NetworkType.TESTNET,
    name: 'toy-testnet',
    title: 'TOY (Testnet)',
    rpcUrl: getRpcUrl('toy-testnet'),
    logoUrl: getLogoUrl(ChainId.TOY_TESTNET),
    blockExplorer: {
      name: 'TOY Testnet Explorer',
      url: 'https://toy-chain-testnet.explorer.caldera.xyz/',
    },
    nativeCurrency: {
      symbol: 'TOY',
      name: 'TOY',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.IMMUTABLE_ZKEVM,
    type: NetworkType.MAINNET,
    name: 'immutable-zkevm',
    title: 'Immutable zkEVM',
    rpcUrl: getRpcUrl('immutable-zkevm'),
    logoUrl: getLogoUrl(ChainId.IMMUTABLE_ZKEVM),
    blockExplorer: {
      name: 'Immutable zkEVM Explorer',
      url: 'https://explorer.immutable.com/',
    },
    nativeCurrency: {
      symbol: 'IMX',
      name: 'IMX',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.IMMUTABLE_ZKEVM_TESTNET,
    type: NetworkType.TESTNET,
    name: 'immutable-zkevm-testnet',
    title: 'Immutable zkEVM Testnet',
    rpcUrl: getRpcUrl('immutable-zkevm-testnet'),
    logoUrl: getLogoUrl(ChainId.IMMUTABLE_ZKEVM_TESTNET),
    blockExplorer: {
      name: 'Immutable zkEVM Testnet Explorer',
      url: 'https://explorer.testnet.immutable.com/',
    },
    nativeCurrency: {
      symbol: 'IMX',
      name: 'IMX',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.MOONBEAM,
    type: NetworkType.MAINNET,
    name: 'moonbeam',
    title: 'Moonbeam',
    rpcUrl: getRpcUrl('moonbeam'),
    logoUrl: getLogoUrl(ChainId.MOONBEAM),
    blockExplorer: {
      name: 'Moonscan',
      url: 'https://moonscan.io/',
    },
    nativeCurrency: {
      symbol: 'GLMR',
      name: 'GLMR',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.MOONBASE_ALPHA,
    type: NetworkType.TESTNET,
    name: 'moonbase-alpha',
    title: 'Moonbase Alpha',
    rpcUrl: getRpcUrl('moonbase-alpha'),
    logoUrl: getLogoUrl(ChainId.MOONBASE_ALPHA),
    blockExplorer: {
      name: 'Moonscan (Moonbase Alpha)',
      url: 'https://moonbase.moonscan.io/',
    },
    nativeCurrency: {
      symbol: 'GLMR',
      name: 'GLMR',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ETHERLINK,
    type: NetworkType.MAINNET,
    name: 'etherlink',
    title: 'Etherlink',
    rpcUrl: getRpcUrl('etherlink'),
    logoUrl: getLogoUrl(ChainId.ETHERLINK),
    blockExplorer: {
      name: 'Etherlink Explorer',
      url: 'https://explorer.etherlink.com/',
    },
    nativeCurrency: {
      symbol: 'XTZ',
      name: 'Tez',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ETHERLINK_TESTNET,
    type: NetworkType.TESTNET,
    name: 'etherlink-testnet',
    title: 'Etherlink Testnet',
    rpcUrl: getRpcUrl('etherlink-testnet'),
    logoUrl: getLogoUrl(ChainId.ETHERLINK_TESTNET),
    blockExplorer: {
      name: 'Etherlink Testnet Explorer',
      url: 'https://testnet.explorer.etherlink.com/',
    },
    nativeCurrency: {
      symbol: 'XTZ',
      name: 'Tez',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.MONAD,
    type: NetworkType.MAINNET,
    name: 'monad',
    title: 'Monad',
    rpcUrl: getRpcUrl('monad'),
    logoUrl: getLogoUrl(ChainId.MONAD),
    blockExplorer: {
      name: 'Monad Explorer',
      url: 'https://mainnet-beta.monvision.io/',
    },
    nativeCurrency: {
      symbol: 'MON',
      name: 'MON',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.MONAD_TESTNET,
    type: NetworkType.TESTNET,
    name: 'monad-testnet',
    title: 'Monad Testnet',
    rpcUrl: getRpcUrl('monad-testnet'),
    logoUrl: getLogoUrl(ChainId.MONAD_TESTNET),
    blockExplorer: {
      name: 'Monad Testnet Explorer',
      url: 'https://testnet.monadexplorer.com/',
    },
    nativeCurrency: {
      symbol: 'MON',
      name: 'MON',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.SOMNIA,
    type: NetworkType.MAINNET,
    name: 'somnia',
    title: 'Somnia',
    rpcUrl: getRpcUrl('somnia'),
    logoUrl: getLogoUrl(ChainId.SOMNIA),
    blockExplorer: {
      name: 'Somnia Explorer',
      url: 'https://mainnet.somnia.w3us.site/',
    },
    nativeCurrency: {
      symbol: 'SOMI',
      name: 'SOMI',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.SOMNIA_TESTNET,
    type: NetworkType.TESTNET,
    name: 'somnia-testnet',
    title: 'Somnia Testnet',
    rpcUrl: getRpcUrl('somnia-testnet'),
    logoUrl: getLogoUrl(ChainId.SOMNIA_TESTNET),
    blockExplorer: {
      name: 'Somnia Testnet Explorer',
      url: 'https://somnia-testnet.socialscan.io/',
    },
    nativeCurrency: {
      symbol: 'STT',
      name: 'STT',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.INCENTIV_TESTNET_V2,
    type: NetworkType.TESTNET,
    name: 'incentiv-testnet-v2',
    title: 'Incentiv Testnet',
    rpcUrl: getRpcUrl('incentiv-testnet-v2'),
    logoUrl: getLogoUrl(ChainId.INCENTIV_TESTNET_V2),
    blockExplorer: {
      name: 'Incentiv Testnet Explorer',
      url: 'https://explorer.testnet.incentiv.net/',
    },
    nativeCurrency: {
      symbol: 'TCENT',
      name: 'TCENT',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.KATANA,
    type: NetworkType.MAINNET,
    name: 'katana',
    title: 'Katana',
    rpcUrl: getRpcUrl('katana'),
    logoUrl: getLogoUrl(ChainId.KATANA),
    blockExplorer: {
      name: 'Katana Explorer',
      url: 'https://katanascan.com/',
    },
    nativeCurrency: {
      symbol: 'ETH',
      name: 'ETH',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.SANDBOX_TESTNET,
    type: NetworkType.TESTNET,
    name: 'sandbox-testnet',
    title: 'Sandbox Testnet',
    rpcUrl: getRpcUrl('sandbox-testnet'),
    logoUrl: getLogoUrl(ChainId.SANDBOX_TESTNET),
    blockExplorer: {
      name: 'Sandbox Testnet Explorer',
      url: 'https://sandbox-testnet.explorer.caldera.xyz/',
    },
    nativeCurrency: {
      symbol: 'SAND',
      name: 'SAND',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.ARC_TESTNET,
    type: NetworkType.TESTNET,
    name: 'arc-testnet',
    title: 'Arc Testnet',
    rpcUrl: getRpcUrl('arc-testnet'),
    logoUrl: getLogoUrl(ChainId.ARC_TESTNET),
    blockExplorer: {
      name: 'Arc Testnet Explorer',
      url: 'https://1jr2dw1zdqvyes8u.blockscout.com/',
    },
    nativeCurrency: {
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
    },
  },
]

function getRpcUrl(networkName: string): string {
  return `https://nodes.sequence.app/${networkName}`
}

function getLogoUrl(chainId: ChainId): string {
  return `https://assets.sequence.info/images/networks/medium/${chainId}.webp`
}

export function getNetworkFromName(networkName: string): Network | undefined {
  return ALL.find((network) => network.name === networkName)
}

export function getNetworkFromChainId(chainId: ChainId | number | bigint | string): Network | undefined {
  return ALL.find((network) => network.chainId === Number(chainId))
}
