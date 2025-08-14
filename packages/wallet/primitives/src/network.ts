export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  LOCAL = 'local',
}

export type BlockExplorerConfig = {
  name?: string
  url: string
}

export interface Network {
  chainId: ChainId
  type: NetworkType
  name: string
  title?: string
  rpc: string
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
    rpc: getRpcUrl('mainnet'),
    logoURI: getLogoUrl(ChainId.MAINNET),
    blockExplorer: {
      name: 'Etherscan',
      url: 'https://etherscan.io/',
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
    rpc: getRpcUrl('ropsten'),
    logoURI: getLogoUrl(ChainId.ROPSTEN),
    blockExplorer: {
      name: 'Etherscan (Ropsten)',
      url: 'https://ropsten.etherscan.io/',
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
    rpc: getRpcUrl('rinkeby'),
    logoURI: getLogoUrl(ChainId.RINKEBY),
    blockExplorer: {
      name: 'Etherscan (Rinkeby)',
      url: 'https://rinkeby.etherscan.io/',
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
    rpc: getRpcUrl('goerli'),
    logoURI: getLogoUrl(ChainId.GOERLI),
    blockExplorer: {
      name: 'Etherscan (Goerli)',
      url: 'https://goerli.etherscan.io/',
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
    rpc: getRpcUrl('kovan'),
    logoURI: getLogoUrl(ChainId.KOVAN),
    blockExplorer: {
      name: 'Etherscan (Kovan)',
      url: 'https://kovan.etherscan.io/',
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
    rpc: getRpcUrl('sepolia'),
    logoURI: getLogoUrl(ChainId.SEPOLIA),
    blockExplorer: {
      name: 'Etherscan (Sepolia)',
      url: 'https://sepolia.etherscan.io/',
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
    rpc: getRpcUrl('polygon'),
    logoURI: getLogoUrl(ChainId.POLYGON),
    blockExplorer: {
      name: 'Polygonscan',
      url: 'https://polygonscan.com/',
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
    rpc: getRpcUrl('mumbai'),
    logoURI: getLogoUrl(ChainId.POLYGON_MUMBAI),
    blockExplorer: {
      name: 'Polygonscan (Mumbai)',
      url: 'https://mumbai.polygonscan.com/',
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
    rpc: getRpcUrl('amoy'),
    logoURI: getLogoUrl(ChainId.POLYGON_AMOY),
    blockExplorer: {
      name: 'OKLink (Amoy)',
      url: 'https://www.oklink.com/amoy/',
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
    rpc: getRpcUrl('polygon-zkevm'),
    logoURI: getLogoUrl(ChainId.POLYGON_ZKEVM),
    blockExplorer: {
      name: 'Polygonscan (zkEVM)',
      url: 'https://zkevm.polygonscan.com/',
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
    rpc: getRpcUrl('bsc'),
    logoURI: getLogoUrl(ChainId.BSC),
    blockExplorer: {
      name: 'BSCScan',
      url: 'https://bscscan.com/',
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
    rpc: getRpcUrl('bsc-testnet'),
    logoURI: getLogoUrl(ChainId.BSC_TESTNET),
    blockExplorer: {
      name: 'BSCScan (Testnet)',
      url: 'https://testnet.bscscan.com/',
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
    rpc: getRpcUrl('optimism'),
    logoURI: getLogoUrl(ChainId.OPTIMISM),
    blockExplorer: {
      name: 'Etherscan (Optimism)',
      url: 'https://optimistic.etherscan.io/',
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
    rpc: getRpcUrl('optimism-kovan'),
    logoURI: getLogoUrl(ChainId.OPTIMISM_KOVAN),
    blockExplorer: {
      name: 'Etherscan (Optimism Kovan)',
      url: 'https://kovan-optimistic.etherscan.io/',
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
    rpc: getRpcUrl('optimism-goerli'),
    logoURI: getLogoUrl(ChainId.OPTIMISM_GOERLI),
    blockExplorer: {
      name: 'Etherscan (Optimism Goerli)',
      url: 'https://goerli-optimistic.etherscan.io/',
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
    rpc: getRpcUrl('optimism-sepolia'),
    logoURI: getLogoUrl(ChainId.OPTIMISM_SEPOLIA),
    blockExplorer: {
      name: 'Etherscan (Optimism Sepolia)',
      url: 'https://sepolia-optimistic.etherscan.io/',
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
    rpc: getRpcUrl('arbitrum'),
    logoURI: getLogoUrl(ChainId.ARBITRUM),
    blockExplorer: {
      name: 'Arbiscan',
      url: 'https://arbiscan.io/',
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
    rpc: getRpcUrl('arbitrum-goerli'),
    logoURI: getLogoUrl(ChainId.ARBITRUM_GOERLI),
    blockExplorer: {
      name: 'Arbiscan (Goerli Testnet)',
      url: 'https://testnet.arbiscan.io/',
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
    rpc: getRpcUrl('arbitrum-sepolia'),
    logoURI: getLogoUrl(ChainId.ARBITRUM_SEPOLIA),
    blockExplorer: {
      name: 'Arbiscan (Sepolia Testnet)',
      url: 'https://sepolia.arbiscan.io/',
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
    rpc: getRpcUrl('arbitrum-nova'),
    logoURI: getLogoUrl(ChainId.ARBITRUM_NOVA),
    blockExplorer: {
      name: 'Arbiscan Nova',
      url: 'https://nova.arbiscan.io/',
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
    rpc: getRpcUrl('avalanche'),
    logoURI: getLogoUrl(ChainId.AVALANCHE),
    blockExplorer: {
      name: 'Snowtrace',
      url: 'https://subnets.avax.network/c-chain/',
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
    rpc: getRpcUrl('avalanche-testnet'),
    logoURI: getLogoUrl(ChainId.AVALANCHE_TESTNET),
    blockExplorer: {
      name: 'Snowtrace (Testnet)',
      url: 'https://subnets-test.avax.network/c-chain/',
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
    rpc: getRpcUrl('gnosis'),
    logoURI: getLogoUrl(ChainId.GNOSIS),
    blockExplorer: {
      name: 'Gnosis Chain Explorer',
      url: 'https://blockscout.com/xdai/mainnet/',
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
    rpc: getRpcUrl('base'),
    logoURI: getLogoUrl(ChainId.BASE),
    blockExplorer: {
      name: 'Base Explorer',
      url: 'https://basescan.org/',
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
    rpc: getRpcUrl('base-goerli'),
    logoURI: getLogoUrl(ChainId.BASE_GOERLI),
    blockExplorer: {
      name: 'Base Goerli Explorer',
      url: 'https://goerli.basescan.org/',
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
    rpc: getRpcUrl('base-sepolia'),
    logoURI: getLogoUrl(ChainId.BASE_SEPOLIA),
    blockExplorer: {
      name: 'Base Sepolia Explorer',
      url: 'https://base-sepolia.blockscout.com/',
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
    rpc: getRpcUrl('homeverse'),
    logoURI: getLogoUrl(ChainId.HOMEVERSE),
    blockExplorer: {
      name: 'Oasys Homeverse Explorer',
      url: 'https://explorer.oasys.homeverse.games/',
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
    rpc: getRpcUrl('homeverse-testnet'),
    logoURI: getLogoUrl(ChainId.HOMEVERSE_TESTNET),
    blockExplorer: {
      name: 'Oasys Homeverse Explorer (Testnet)',
      url: 'https://explorer.testnet.oasys.homeverse.games/',
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
    rpc: getRpcUrl('xai'),
    logoURI: getLogoUrl(ChainId.XAI),
    blockExplorer: {
      name: 'Xai Explorer',
      url: 'https://explorer.xai-chain.net/',
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
    rpc: getRpcUrl('xai-sepolia'),
    logoURI: getLogoUrl(ChainId.XAI_SEPOLIA),
    blockExplorer: {
      name: 'Xai Sepolia Explorer',
      url: 'https://testnet-explorer-v2.xai-chain.net/',
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
    rpc: getRpcUrl('b3'),
    logoURI: getLogoUrl(ChainId.B3),
    blockExplorer: {
      name: 'B3 Explorer',
      url: 'https://explorer.b3.fun/',
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
    rpc: getRpcUrl('b3-sepolia'),
    logoURI: getLogoUrl(ChainId.B3_SEPOLIA),
    blockExplorer: {
      name: 'B3 Sepolia Explorer',
      url: 'https://sepolia.explorer.b3.fun/',
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
    rpc: getRpcUrl('apechain'),
    logoURI: getLogoUrl(ChainId.APECHAIN),
    blockExplorer: {
      name: 'APE Chain Explorer',
      url: 'https://apechain.calderaexplorer.xyz/',
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
    rpc: getRpcUrl('apechain-testnet'),
    logoURI: getLogoUrl(ChainId.APECHAIN_TESTNET),
    blockExplorer: {
      name: 'APE Chain Explorer',
      url: 'https://curtis.explorer.caldera.xyz/',
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
    rpc: getRpcUrl('blast'),
    logoURI: getLogoUrl(ChainId.BLAST),
    blockExplorer: {
      name: 'Blast Explorer',
      url: 'https://blastscan.io/',
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
    rpc: getRpcUrl('blast-sepolia'),
    logoURI: getLogoUrl(ChainId.BLAST_SEPOLIA),
    blockExplorer: {
      name: 'Blast Sepolia Explorer',
      url: 'https://sepolia.blastexplorer.io/',
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
    rpc: getRpcUrl('telos'),
    logoURI: getLogoUrl(ChainId.TELOS),
    blockExplorer: {
      name: 'Telos Explorer',
      url: 'https://explorer.telos.net/network/',
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
    rpc: getRpcUrl('telos-testnet'),
    logoURI: getLogoUrl(ChainId.TELOS_TESTNET),
    blockExplorer: {
      name: 'Telos Testnet Explorer',
      url: 'https://explorer-test.telos.net/network',
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
    rpc: getRpcUrl('borne-testnet'),
    logoURI: getLogoUrl(ChainId.BORNE_TESTNET),
    blockExplorer: {
      name: 'Borne Testnet Explorer',
      url: 'https://subnets-test.avax.network/bornegfdn',
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
    rpc: getRpcUrl('skale-nebula'),
    logoURI: getLogoUrl(ChainId.SKALE_NEBULA),
    blockExplorer: {
      name: 'SKALE Nebula Gaming Hub Explorer',
      url: 'https://green-giddy-denebola.explorer.mainnet.skalenodes.com/',
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
    rpc: getRpcUrl('skale-nebula-testnet'),
    logoURI: getLogoUrl(ChainId.SKALE_NEBULA_TESTNET),
    blockExplorer: {
      name: 'SKALE Nebula Gaming Hub Testnet Explorer',
      url: 'https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com/',
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
    rpc: getRpcUrl('soneium'),
    logoURI: getLogoUrl(ChainId.SONEIUM),
    blockExplorer: {
      name: 'Soneium Explorer',
      url: 'https://soneium.blockscout.com/',
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
    rpc: getRpcUrl('soneium-minato'),
    logoURI: getLogoUrl(ChainId.SONEIUM_MINATO),
    blockExplorer: {
      name: 'Soneium Minato Explorer',
      url: 'https://explorer-testnet.soneium.org/',
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
    rpc: getRpcUrl('toy-testnet'),
    logoURI: getLogoUrl(ChainId.TOY_TESTNET),
    blockExplorer: {
      name: 'TOY Testnet Explorer',
      url: 'https://toy-chain-testnet.explorer.caldera.xyz/',
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
    rpc: getRpcUrl('immutable-zkevm'),
    logoURI: getLogoUrl(ChainId.IMMUTABLE_ZKEVM),
    blockExplorer: {
      name: 'Immutable zkEVM Explorer',
      url: 'https://explorer.immutable.com/',
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
    rpc: getRpcUrl('immutable-zkevm-testnet'),
    logoURI: getLogoUrl(ChainId.IMMUTABLE_ZKEVM_TESTNET),
    blockExplorer: {
      name: 'Immutable zkEVM Testnet Explorer',
      url: 'https://explorer.testnet.immutable.com/',
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
    rpc: getRpcUrl('rootnet'),
    logoURI: getLogoUrl(ChainId.ROOT_NETWORK),
    blockExplorer: {
      name: 'The Root Network Explorer',
      url: 'https://rootscan.io/',
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
    rpc: getRpcUrl('rootnet-porcini'),
    logoURI: getLogoUrl(ChainId.ROOT_NETWORK_PORCINI),
    blockExplorer: {
      name: 'The Root Network Porcini Testnet Explorer',
      url: 'https://porcini.rootscan.io/',
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
    rpc: 'http://localhost:8545',
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
    rpc: 'http://localhost:8545',
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
    rpc: getRpcUrl('laos'),
    logoURI: getLogoUrl(ChainId.LAOS),
    blockExplorer: {
      name: 'LAOS Explorer',
      url: 'https://blockscout.laos.laosfoundation.io/',
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
    rpc: getRpcUrl('laos-sigma-testnet'),
    logoURI: getLogoUrl(ChainId.LAOS_SIGMA_TESTNET),
    blockExplorer: {
      name: 'LAOS Sigma Testnet Explorer',
      url: 'https://sigma.explorer.laosnetwork.io/',
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
    rpc: getRpcUrl('moonbeam'),
    logoURI: getLogoUrl(ChainId.MOONBEAM),
    blockExplorer: {
      name: 'Moonscan',
      url: 'https://moonscan.io/',
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
    rpc: getRpcUrl('moonbase-alpha'),
    logoURI: getLogoUrl(ChainId.MOONBASE_ALPHA),
    blockExplorer: {
      name: 'Moonscan (Moonbase Alpha)',
      url: 'https://moonbase.moonscan.io/',
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
    rpc: getRpcUrl('etherlink'),
    logoURI: getLogoUrl(ChainId.ETHERLINK),
    blockExplorer: {
      name: 'Etherlink Explorer',
      url: 'https://explorer.etherlink.com/',
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
    rpc: getRpcUrl('etherlink-testnet'),
    logoURI: getLogoUrl(ChainId.ETHERLINK_TESTNET),
    blockExplorer: {
      name: 'Etherlink Testnet Explorer',
      url: 'https://testnet.explorer.etherlink.com/',
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
    rpc: getRpcUrl('monad-testnet'),
    logoURI: getLogoUrl(ChainId.MONAD_TESTNET),
    blockExplorer: {
      name: 'Monad Testnet Explorer',
      url: 'https://testnet.monadexplorer.com/',
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
    rpc: getRpcUrl('somnia-testnet'),
    logoURI: getLogoUrl(ChainId.SOMNIA_TESTNET),
    blockExplorer: {
      name: 'Somnia Testnet Explorer',
      url: 'https://somnia-testnet.socialscan.io/',
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
    rpc: getRpcUrl('incentiv-testnet'),
    logoURI: getLogoUrl(ChainId.INCENTIV_TESTNET),
    blockExplorer: {
      name: 'Incentiv Testnet Explorer',
      url: 'https://explorer.testnet.incentiv.net/',
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
    rpc: getRpcUrl('sei'),
    logoURI: getLogoUrl(ChainId.SEI),
    blockExplorer: {
      name: 'SEI Explorer',
      url: 'https://seitrace.com/?chain=pacific-1',
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
    rpc: getRpcUrl('sei-testnet'),
    logoURI: getLogoUrl(ChainId.SEI_TESTNET),
    blockExplorer: {
      name: 'Sei Testnet Explorer',
      url: 'https://seitrace.com/?chain=atlantic-2',
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
    rpc: getRpcUrl('somnia'),
    logoURI: getLogoUrl(ChainId.SOMNIA),
    blockExplorer: {
      name: 'Somnia Explorer',
      url: 'https://mainnet.somnia.w3us.site/',
    },
    nativeToken: {
      symbol: 'SOMI',
      name: 'SOMI',
      decimals: 18,
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

export function getNetworkFromChainId(chainId: ChainId | bigint | number): Network | undefined {
  return ALL.find((network) => network.chainId === BigInt(chainId))
}
