export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  LOCAL = 'local',
}

export type BlockExplorerConfig = {
  name?: string
  rootUrl: string
}

export interface Network {
  chainId: ChainId
  type: NetworkType
  name: string
  title?: string
  logoURI?: string
  blockExplorer?: BlockExplorerConfig
  nativeToken: {
    symbol: string
    name: string
    decimals: number
  }
  ensAddress?: string
  deprecated?: true
}

export const ChainId = {
  // Ethereum
  MAINNET: 1n,
  ROPSTEN: 3n, // network is deprecated
  RINKEBY: 4n, // network is deprecated
  GOERLI: 5n, // network is deprecated
  KOVAN: 42n, // network is deprecated
  SEPOLIA: 11155111n,

  // Polygon
  POLYGON: 137n,
  POLYGON_MUMBAI: 80001n, // network is deprecated
  POLYGON_ZKEVM: 1101n,
  POLYGON_AMOY: 80002n,

  // BSC
  BSC: 56n,
  BSC_TESTNET: 97n,

  // Optimism
  OPTIMISM: 10n,
  OPTIMISM_KOVAN: 69n, // network is deprecated
  OPTIMISM_GOERLI: 420n, // network is deprecated
  OPTIMISM_SEPOLIA: 11155420n,

  // Arbitrum One
  ARBITRUM: 42161n,
  ARBITRUM_GOERLI: 421613n, // network is deprecated
  ARBITRUM_SEPOLIA: 421614n,

  // Arbitrum Nova
  ARBITRUM_NOVA: 42170n,

  // Avalanche
  AVALANCHE: 43114n,
  AVALANCHE_TESTNET: 43113n,

  // Gnosis Chain (XDAI)
  GNOSIS: 100n,

  // BASE
  BASE: 8453n,
  BASE_GOERLI: 84531n, // network is deprecated
  BASE_SEPOLIA: 84532n,

  // HOMEVERSE
  HOMEVERSE_TESTNET: 40875n,
  HOMEVERSE: 19011n,

  // Xai
  XAI: 660279n,
  XAI_SEPOLIA: 37714555429n,

  // TELOS
  TELOS: 40n,
  TELOS_TESTNET: 41n,

  // B3 Sepolia
  B3: 8333n,
  B3_SEPOLIA: 1993n,

  // APE Chain
  APECHAIN: 33139n,
  APECHAIN_TESTNET: 33111n,

  // Blast
  BLAST: 81457n,
  BLAST_SEPOLIA: 168587773n,

  // Borne
  BORNE_TESTNET: 94984n,

  // SKALE Nebula
  SKALE_NEBULA: 1482601649n,
  SKALE_NEBULA_TESTNET: 37084624n,

  // Soneium Minato
  SONEIUM_MINATO: 1946n,
  SONEIUM: 1868n,

  // TOY Testnet
  TOY_TESTNET: 21000000n,

  // Immutable zkEVM
  IMMUTABLE_ZKEVM: 13371n,
  IMMUTABLE_ZKEVM_TESTNET: 13473n,

  // The Root Network
  ROOT_NETWORK: 7668n,
  ROOT_NETWORK_PORCINI: 7672n,

  // HARDHAT TESTNETS
  HARDHAT: 31337n,
  HARDHAT_2: 31338n,

  // LAOS
  LAOS: 6283n,
  LAOS_SIGMA_TESTNET: 62850n,

  // ETHERLINK
  ETHERLINK: 42793n,
  ETHERLINK_TESTNET: 128123n,

  // MOONBEAM
  MOONBEAM: 1284n,
  MOONBASE_ALPHA: 1287n,

  // MONAD
  MONAD_TESTNET: 10143n,

  // SOMNIA
  SOMNIA_TESTNET: 50312n,
  SOMNIA: 5031n,

  // INCENTIV
  INCENTIV_TESTNET: 11690n,

  // SEI
  SEI: 1329n,
  SEI_TESTNET: 1328n,
} as const

export type ChainId = (typeof ChainId)[keyof typeof ChainId]

export const ALL: Network[] = [
  {
    chainId: ChainId.MAINNET,
    type: NetworkType.MAINNET,
    name: 'mainnet',
    title: 'Ethereum',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.MAINNET}.webp`,
    blockExplorer: {
      name: 'Etherscan',
      rootUrl: 'https://etherscan.io/',
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  },
  {
    chainId: ChainId.ROPSTEN,
    type: NetworkType.TESTNET,
    name: 'ropsten',
    title: 'Ropsten',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ROPSTEN}.webp`,
    blockExplorer: {
      name: 'Etherscan (Ropsten)',
      rootUrl: 'https://ropsten.etherscan.io/',
    },
    nativeToken: {
      symbol: 'roETH',
      name: 'Ropsten Ether',
      decimals: 18,
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    deprecated: true,
  },
  {
    chainId: ChainId.RINKEBY,
    type: NetworkType.TESTNET,
    name: 'rinkeby',
    title: 'Rinkeby',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.RINKEBY}.webp`,
    blockExplorer: {
      name: 'Etherscan (Rinkeby)',
      rootUrl: 'https://rinkeby.etherscan.io/',
    },
    nativeToken: {
      symbol: 'rETH',
      name: 'Rinkeby Ether',
      decimals: 18,
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    deprecated: true,
  },
  {
    chainId: ChainId.GOERLI,
    type: NetworkType.TESTNET,
    name: 'goerli',
    title: 'Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.GOERLI}.webp`,
    blockExplorer: {
      name: 'Etherscan (Goerli)',
      rootUrl: 'https://goerli.etherscan.io/',
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18,
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    deprecated: true,
  },
  {
    chainId: ChainId.KOVAN,
    type: NetworkType.TESTNET,
    name: 'kovan',
    title: 'Kovan',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.KOVAN}.webp`,
    blockExplorer: {
      name: 'Etherscan (Kovan)',
      rootUrl: 'https://kovan.etherscan.io/',
    },
    nativeToken: {
      symbol: 'kETH',
      name: 'Kovan Ether',
      decimals: 18,
    },
    deprecated: true,
  },
  {
    chainId: ChainId.SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'sepolia',
    title: 'Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SEPOLIA}.webp`,
    blockExplorer: {
      name: 'Etherscan (Sepolia)',
      rootUrl: 'https://sepolia.etherscan.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON}.webp`,
    blockExplorer: {
      name: 'Polygonscan',
      rootUrl: 'https://polygonscan.com/',
    },
    nativeToken: {
      symbol: 'POL',
      name: 'POL',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.POLYGON_MUMBAI,
    type: NetworkType.TESTNET,
    name: 'mumbai',
    title: 'Polygon Mumbai',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON_MUMBAI}.webp`,
    blockExplorer: {
      name: 'Polygonscan (Mumbai)',
      rootUrl: 'https://mumbai.polygonscan.com/',
    },
    nativeToken: {
      symbol: 'mMATIC',
      name: 'Mumbai Polygon',
      decimals: 18,
    },
    deprecated: true,
  },
  {
    chainId: ChainId.POLYGON_AMOY,
    type: NetworkType.TESTNET,
    name: 'amoy',
    title: 'Polygon Amoy',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON_AMOY}.webp`,
    blockExplorer: {
      name: 'OKLink (Amoy)',
      rootUrl: 'https://www.oklink.com/amoy/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON_ZKEVM}.webp`,
    blockExplorer: {
      name: 'Polygonscan (zkEVM)',
      rootUrl: 'https://zkevm.polygonscan.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BSC}.webp`,
    blockExplorer: {
      name: 'BSCScan',
      rootUrl: 'https://bscscan.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BSC_TESTNET}.webp`,
    blockExplorer: {
      name: 'BSCScan (Testnet)',
      rootUrl: 'https://testnet.bscscan.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM}.webp`,
    blockExplorer: {
      name: 'Etherscan (Optimism)',
      rootUrl: 'https://optimistic.etherscan.io/',
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.OPTIMISM_KOVAN,
    type: NetworkType.TESTNET,
    name: 'optimism-kovan',
    title: 'Optimism Kovan',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM_KOVAN}.webp`,
    blockExplorer: {
      name: 'Etherscan (Optimism Kovan)',
      rootUrl: 'https://kovan-optimistic.etherscan.io/',
    },
    nativeToken: {
      symbol: 'kETH',
      name: 'Kovan Ether',
      decimals: 18,
    },
    deprecated: true,
  },
  {
    chainId: ChainId.OPTIMISM_GOERLI,
    type: NetworkType.TESTNET,
    name: 'optimism-goerli',
    title: 'Optimism Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM_GOERLI}.webp`,
    blockExplorer: {
      name: 'Etherscan (Optimism Goerli)',
      rootUrl: 'https://goerli-optimistic.etherscan.io/',
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18,
    },
    deprecated: true,
  },
  {
    chainId: ChainId.OPTIMISM_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'optimism-sepolia',
    title: 'Optimism Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM_SEPOLIA}.webp`,
    blockExplorer: {
      name: 'Etherscan (Optimism Sepolia)',
      rootUrl: 'https://sepolia-optimistic.etherscan.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM}.webp`,
    blockExplorer: {
      name: 'Arbiscan',
      rootUrl: 'https://arbiscan.io/',
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ARBITRUM_GOERLI,
    type: NetworkType.TESTNET,
    name: 'arbitrum-goerli',
    title: 'Arbitrum Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM_GOERLI}.webp`,
    blockExplorer: {
      name: 'Arbiscan (Goerli Testnet)',
      rootUrl: 'https://testnet.arbiscan.io/',
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18,
    },
    deprecated: true,
  },
  {
    chainId: ChainId.ARBITRUM_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'arbitrum-sepolia',
    title: 'Arbitrum Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM_SEPOLIA}.webp`,
    blockExplorer: {
      name: 'Arbiscan (Sepolia Testnet)',
      rootUrl: 'https://sepolia.arbiscan.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM_NOVA}.webp`,
    blockExplorer: {
      name: 'Arbiscan Nova',
      rootUrl: 'https://nova.arbiscan.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.AVALANCHE}.webp`,
    blockExplorer: {
      name: 'Snowtrace',
      rootUrl: 'https://subnets.avax.network/c-chain/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.AVALANCHE_TESTNET}.webp`,
    blockExplorer: {
      name: 'Snowtrace (Testnet)',
      rootUrl: 'https://subnets-test.avax.network/c-chain/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.GNOSIS}.webp`,
    blockExplorer: {
      name: 'Gnosis Chain Explorer',
      rootUrl: 'https://blockscout.com/xdai/mainnet/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BASE}.webp`,
    blockExplorer: {
      name: 'Base Explorer',
      rootUrl: 'https://basescan.org/',
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BASE_GOERLI,
    type: NetworkType.TESTNET,
    name: 'base-goerli',
    title: 'Base Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BASE_GOERLI}.webp`,
    blockExplorer: {
      name: 'Base Goerli Explorer',
      rootUrl: 'https://goerli.basescan.org/',
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18,
    },
    deprecated: true,
  },
  {
    chainId: ChainId.BASE_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'base-sepolia',
    title: 'Base Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BASE_SEPOLIA}.webp`,
    blockExplorer: {
      name: 'Base Sepolia Explorer',
      rootUrl: 'https://base-sepolia.blockscout.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.HOMEVERSE}.webp`,
    blockExplorer: {
      name: 'Oasys Homeverse Explorer',
      rootUrl: 'https://explorer.oasys.homeverse.games/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.HOMEVERSE_TESTNET}.webp`,
    blockExplorer: {
      name: 'Oasys Homeverse Explorer (Testnet)',
      rootUrl: 'https://explorer.testnet.oasys.homeverse.games/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.XAI}.webp`,
    blockExplorer: {
      name: 'Xai Explorer',
      rootUrl: 'https://explorer.xai-chain.net/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.XAI_SEPOLIA}.webp`,
    blockExplorer: {
      name: 'Xai Sepolia Explorer',
      rootUrl: 'https://testnet-explorer-v2.xai-chain.net/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.B3}.webp`,
    blockExplorer: {
      name: 'B3 Explorer',
      rootUrl: 'https://explorer.b3.fun/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.B3_SEPOLIA}.webp`,
    blockExplorer: {
      name: 'B3 Sepolia Explorer',
      rootUrl: 'https://sepolia.explorer.b3.fun/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.APECHAIN}.webp`,
    blockExplorer: {
      name: 'APE Chain Explorer',
      rootUrl: 'https://apechain.calderaexplorer.xyz/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.APECHAIN_TESTNET}.webp`,
    blockExplorer: {
      name: 'APE Chain Explorer',
      rootUrl: 'https://curtis.explorer.caldera.xyz/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BLAST}.webp`,
    blockExplorer: {
      name: 'Blast Explorer',
      rootUrl: 'https://blastscan.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BLAST_SEPOLIA}.webp`,
    blockExplorer: {
      name: 'Blast Sepolia Explorer',
      rootUrl: 'https://sepolia.blastexplorer.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.TELOS}.webp`,
    blockExplorer: {
      name: 'Telos Explorer',
      rootUrl: 'https://explorer.telos.net/network/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.TELOS_TESTNET}.webp`,
    blockExplorer: {
      name: 'Telos Testnet Explorer',
      rootUrl: 'https://explorer-test.telos.net/network',
    },
    nativeToken: {
      symbol: 'TLOS',
      name: 'TLOS',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.BORNE_TESTNET,
    type: NetworkType.TESTNET,
    name: 'borne-testnet',
    title: 'Borne Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BORNE_TESTNET}.webp`,
    blockExplorer: {
      name: 'Borne Testnet Explorer',
      rootUrl: 'https://subnets-test.avax.network/bornegfdn',
    },
    nativeToken: {
      symbol: 'BORNE',
      name: 'BORNE',
      decimals: 18,
    },
    deprecated: true,
  },
  {
    chainId: ChainId.SKALE_NEBULA,
    type: NetworkType.MAINNET,
    name: 'skale-nebula',
    title: 'SKALE Nebula Gaming Hub',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SKALE_NEBULA}.webp`,
    blockExplorer: {
      name: 'SKALE Nebula Gaming Hub Explorer',
      rootUrl: 'https://green-giddy-denebola.explorer.mainnet.skalenodes.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SKALE_NEBULA_TESTNET}.webp`,
    blockExplorer: {
      name: 'SKALE Nebula Gaming Hub Testnet Explorer',
      rootUrl: 'https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SONEIUM}.webp`,
    blockExplorer: {
      name: 'Soneium Explorer',
      rootUrl: 'https://soneium.blockscout.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SONEIUM_MINATO}.webp`,
    blockExplorer: {
      name: 'Soneium Minato Explorer',
      rootUrl: 'https://explorer-testnet.soneium.org/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.TOY_TESTNET}.webp`,
    blockExplorer: {
      name: 'TOY Testnet Explorer',
      rootUrl: 'https://toy-chain-testnet.explorer.caldera.xyz/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.IMMUTABLE_ZKEVM}.webp`,
    blockExplorer: {
      name: 'Immutable zkEVM Explorer',
      rootUrl: 'https://explorer.immutable.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.IMMUTABLE_ZKEVM_TESTNET}.webp`,
    blockExplorer: {
      name: 'Immutable zkEVM Testnet Explorer',
      rootUrl: 'https://explorer.testnet.immutable.com/',
    },
    nativeToken: {
      symbol: 'IMX',
      name: 'IMX',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ROOT_NETWORK,
    type: NetworkType.MAINNET,
    name: 'rootnet',
    title: 'The Root Network',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ROOT_NETWORK}.webp`,
    blockExplorer: {
      name: 'The Root Network Explorer',
      rootUrl: 'https://rootscan.io/',
    },
    nativeToken: {
      symbol: 'XRP',
      name: 'XRP',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.ROOT_NETWORK_PORCINI,
    type: NetworkType.TESTNET,
    name: 'rootnet-porcini',
    title: 'The Root Network Porcini Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ROOT_NETWORK_PORCINI}.webp`,
    blockExplorer: {
      name: 'The Root Network Porcini Testnet Explorer',
      rootUrl: 'https://porcini.rootscan.io/',
    },
    nativeToken: {
      symbol: 'XRP',
      name: 'XRP',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.HARDHAT,
    type: NetworkType.LOCAL,
    name: 'hardhat',
    title: 'Hardhat (local testnet)',
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.HARDHAT_2,
    type: NetworkType.LOCAL,
    name: 'hardhat2',
    title: 'Hardhat (local testnet)',
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.LAOS,
    type: NetworkType.MAINNET,
    name: 'laos',
    title: 'LAOS',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.LAOS}.webp`,
    blockExplorer: {
      name: 'LAOS Explorer',
      rootUrl: 'https://blockscout.laos.laosfoundation.io/',
    },
    nativeToken: {
      symbol: 'LAOS',
      name: 'LAOS',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.LAOS_SIGMA_TESTNET,
    type: NetworkType.TESTNET,
    name: 'laos-sigma-testnet',
    title: 'LAOS Sigma Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.LAOS_SIGMA_TESTNET}.webp`,
    blockExplorer: {
      name: 'LAOS Sigma Testnet Explorer',
      rootUrl: 'https://sigma.explorer.laosnetwork.io/',
    },
    nativeToken: {
      symbol: 'SIGMA',
      name: 'SIGMA',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.MOONBEAM,
    type: NetworkType.MAINNET,
    name: 'moonbeam',
    title: 'Moonbeam',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.MOONBEAM}.webp`,
    blockExplorer: {
      name: 'Moonscan',
      rootUrl: 'https://moonscan.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.MOONBASE_ALPHA}.webp`,
    blockExplorer: {
      name: 'Moonscan (Moonbase Alpha)',
      rootUrl: 'https://moonbase.moonscan.io/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ETHERLINK}.webp`,
    blockExplorer: {
      name: 'Etherlink Explorer',
      rootUrl: 'https://explorer.etherlink.com/',
    },
    nativeToken: {
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
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ETHERLINK_TESTNET}.webp`,
    blockExplorer: {
      name: 'Etherlink Testnet Explorer',
      rootUrl: 'https://testnet.explorer.etherlink.com/',
    },
    nativeToken: {
      symbol: 'XTZ',
      name: 'Tez',
      decimals: 18,
    },
  },
  {
    chainId: ChainId.MONAD_TESTNET,
    type: NetworkType.TESTNET,
    name: 'monad-testnet',
    title: 'Monad Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.MONAD_TESTNET}.webp`,
    blockExplorer: {
      name: 'Monad Testnet Explorer',
      rootUrl: 'https://testnet.monadexplorer.com/',
    },
    nativeToken: {
      symbol: 'MON',
      name: 'MON',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.SOMNIA_TESTNET,
    type: NetworkType.TESTNET,
    name: 'somnia-testnet',
    title: 'Somnia Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SOMNIA_TESTNET}.webp`,
    blockExplorer: {
      name: 'Somnia Testnet Explorer',
      rootUrl: 'https://somnia-testnet.socialscan.io/',
    },
    nativeToken: {
      symbol: 'STT',
      name: 'STT',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.INCENTIV_TESTNET,
    type: NetworkType.TESTNET,
    name: 'incentiv-testnet',
    title: 'Incentiv Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.INCENTIV_TESTNET}.webp`,
    blockExplorer: {
      name: 'Incentiv Testnet Explorer',
      rootUrl: 'https://explorer.testnet.incentiv.net/',
    },
    nativeToken: {
      symbol: 'CENT',
      name: 'CENT',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.SEI,
    type: NetworkType.MAINNET,
    name: 'sei',
    title: 'Sei',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SEI}.webp`,
    blockExplorer: {
      name: 'SEI Explorer',
      rootUrl: 'https://seitrace.com/?chain=pacific-1',
    },
    nativeToken: {
      symbol: 'SEI',
      name: 'SEI',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.SEI_TESTNET,
    type: NetworkType.TESTNET,
    name: 'sei-testnet',
    title: 'Sei Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SEI_TESTNET}.webp`,
    blockExplorer: {
      name: 'Sei Testnet Explorer',
      rootUrl: 'https://seitrace.com/?chain=atlantic-2',
    },
    nativeToken: {
      symbol: 'SEI',
      name: 'SEI',
      decimals: 18,
    },
  },

  {
    chainId: ChainId.SOMNIA,
    type: NetworkType.MAINNET,
    name: 'somnia',
    title: 'Somnia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SOMNIA}.webp`,
    blockExplorer: {
      name: 'Somnia Explorer',
      rootUrl: 'https://mainnet.somnia.w3us.site/',
    },
    nativeToken: {
      symbol: 'SOMI',
      name: 'SOMI',
      decimals: 18,
    },
  },
]

export function getNetworkFromName(networkName: string): Network | undefined {
  return ALL.find((network) => network.name === networkName)
}

export function getNetworkFromChainId(chainId: ChainId | bigint | number): Network | undefined {
  return ALL.find((network) => network.chainId === BigInt(chainId))
}

export function getRpcUrl(network: Network): string {
  return `https://nodes.sequence.app/${network.name}`
}
