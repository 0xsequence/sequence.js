export enum ChainId {
  // Ethereum
  MAINNET = 1,
  ROPSTEN = 3, // network is deprecated
  RINKEBY = 4, // network is deprecated
  GOERLI = 5, // network is deprecated
  KOVAN = 42, // network is deprecated
  SEPOLIA = 11155111,

  // Polygon
  POLYGON = 137,
  POLYGON_MUMBAI = 80001, // network is deprecated
  POLYGON_ZKEVM = 1101,
  POLYGON_AMOY = 80002,

  // BSC
  BSC = 56,
  BSC_TESTNET = 97,

  // Optimism
  OPTIMISM = 10,
  OPTIMISM_KOVAN = 69, // network is deprecated
  OPTIMISM_GOERLI = 420, // network is deprecated
  OPTIMISM_SEPOLIA = 11155420,

  // Arbitrum One
  ARBITRUM = 42161,
  ARBITRUM_GOERLI = 421613, // network is deprecated
  ARBITRUM_SEPOLIA = 421614,

  // Arbitrum Nova
  ARBITRUM_NOVA = 42170,

  // Avalanche
  AVALANCHE = 43114,
  AVALANCHE_TESTNET = 43113,

  // Gnosis Chain (XDAI)
  GNOSIS = 100,

  // BASE
  BASE = 8453,
  BASE_GOERLI = 84531, // network is deprecated
  BASE_SEPOLIA = 84532,

  // HOMEVERSE
  HOMEVERSE_TESTNET = 40875,
  HOMEVERSE = 19011,

  // Xai
  XAI = 660279,
  XAI_SEPOLIA = 37714555429,

  // Astar
  ASTAR_ZKEVM = 3776,
  ASTAR_ZKYOTO = 6038361,

  // XR
  XR_SEPOLIA = 2730,

  // TELOS
  TELOS = 40,

  // B3 Sepolia
  B3_SEPOLIA = 1993,

  // APE Chain
  APECHAIN_TESTNET = 33111,

  // Blast
  BLAST = 81457,
  BLAST_SEPOLIA = 168587773,

  // Borne
  BORNE_TESTNET = 94984,

  // HARDHAT TESTNETS
  HARDHAT = 31337,
  HARDHAT_2 = 31338
}

export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet'
}

export type BlockExplorerConfig = {
  name?: string
  rootUrl: string
  addressUrl?: string
  txnHashUrl?: string
}

export interface NetworkMetadata {
  chainId: ChainId
  type?: NetworkType
  name: string
  title?: string
  logoURI?: string
  blockExplorer?: BlockExplorerConfig
  ensAddress?: string
  testnet?: boolean // Deprecated field, use type instead
  deprecated?: boolean // The actual network is deprecated
  nativeToken: {
    symbol: string
    name: string
    decimals: number
  }
}

export const networks: Record<ChainId, NetworkMetadata> = {
  [ChainId.MAINNET]: {
    chainId: ChainId.MAINNET,
    type: NetworkType.MAINNET,
    name: 'mainnet',
    title: 'Ethereum',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.MAINNET}.webp`,
    blockExplorer: {
      name: 'Etherscan',
      rootUrl: 'https://etherscan.io/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  [ChainId.ROPSTEN]: {
    chainId: ChainId.ROPSTEN,
    type: NetworkType.TESTNET,
    name: 'ropsten',
    title: 'Ropsten',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ROPSTEN}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Ropsten)',
      rootUrl: 'https://ropsten.etherscan.io/'
    },
    nativeToken: {
      symbol: 'roETH',
      name: 'Ropsten Ether',
      decimals: 18
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    deprecated: true
  },
  [ChainId.RINKEBY]: {
    chainId: ChainId.RINKEBY,
    type: NetworkType.TESTNET,
    name: 'rinkeby',
    title: 'Rinkeby',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.RINKEBY}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Rinkeby)',
      rootUrl: 'https://rinkeby.etherscan.io/'
    },
    nativeToken: {
      symbol: 'rETH',
      name: 'Rinkeby Ether',
      decimals: 18
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    deprecated: true
  },
  [ChainId.GOERLI]: {
    chainId: ChainId.GOERLI,
    type: NetworkType.TESTNET,
    name: 'goerli',
    title: 'Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.GOERLI}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Goerli)',
      rootUrl: 'https://goerli.etherscan.io/'
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18
    },
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    deprecated: true
  },
  [ChainId.KOVAN]: {
    chainId: ChainId.KOVAN,
    type: NetworkType.TESTNET,
    name: 'kovan',
    title: 'Kovan',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.KOVAN}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Kovan)',
      rootUrl: 'https://kovan.etherscan.io/'
    },
    nativeToken: {
      symbol: 'kETH',
      name: 'Kovan Ether',
      decimals: 18
    },
    deprecated: true
  },
  [ChainId.SEPOLIA]: {
    chainId: ChainId.SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'sepolia',
    title: 'Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Sepolia)',
      rootUrl: 'https://sepolia.etherscan.io/'
    },
    nativeToken: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18
    }
  },
  [ChainId.POLYGON]: {
    chainId: ChainId.POLYGON,
    type: NetworkType.MAINNET,
    name: 'polygon',
    title: 'Polygon',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON}.webp`,
    blockExplorer: {
      name: 'Polygonscan',
      rootUrl: 'https://polygonscan.com/'
    },
    nativeToken: {
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18
    }
  },
  [ChainId.POLYGON_MUMBAI]: {
    chainId: ChainId.POLYGON_MUMBAI,
    type: NetworkType.TESTNET,
    name: 'mumbai',
    title: 'Polygon Mumbai',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON_MUMBAI}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Polygonscan (Mumbai)',
      rootUrl: 'https://mumbai.polygonscan.com/'
    },
    nativeToken: {
      symbol: 'mMATIC',
      name: 'Mumbai Polygon',
      decimals: 18
    },
    deprecated: true
  },
  [ChainId.POLYGON_AMOY]: {
    chainId: ChainId.POLYGON_AMOY,
    type: NetworkType.TESTNET,
    name: 'amoy',
    title: 'Polygon Amoy',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON_AMOY}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'OKLink (Amoy)',
      rootUrl: 'https://www.oklink.com/amoy/'
    },
    nativeToken: {
      symbol: 'aMATIC',
      name: 'Amoy Polygon',
      decimals: 18
    }
  },
  [ChainId.POLYGON_ZKEVM]: {
    chainId: ChainId.POLYGON_ZKEVM,
    type: NetworkType.MAINNET,
    name: 'polygon-zkevm',
    title: 'Polygon zkEVM',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.POLYGON_ZKEVM}.webp`,
    blockExplorer: {
      name: 'Polygonscan (zkEVM)',
      rootUrl: 'https://zkevm.polygonscan.com/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.BSC]: {
    chainId: ChainId.BSC,
    type: NetworkType.MAINNET,
    name: 'bsc',
    title: 'BNB Smart Chain',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BSC}.webp`,
    blockExplorer: {
      name: 'BSCScan',
      rootUrl: 'https://bscscan.com/'
    },
    nativeToken: {
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18
    }
  },
  [ChainId.BSC_TESTNET]: {
    chainId: ChainId.BSC_TESTNET,
    type: NetworkType.TESTNET,
    name: 'bsc-testnet',
    title: 'BNB Smart Chain Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BSC_TESTNET}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'BSCScan (Testnet)',
      rootUrl: 'https://testnet.bscscan.com/'
    },
    nativeToken: {
      symbol: 'tBNB',
      name: 'Testnet BNB',
      decimals: 18
    }
  },
  [ChainId.OPTIMISM]: {
    chainId: ChainId.OPTIMISM,
    type: NetworkType.MAINNET,
    name: 'optimism',
    title: 'Optimism',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM}.webp`,
    blockExplorer: {
      name: 'Etherscan (Optimism)',
      rootUrl: 'https://optimistic.etherscan.io/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.OPTIMISM_KOVAN]: {
    chainId: ChainId.OPTIMISM_KOVAN,
    type: NetworkType.TESTNET,
    name: 'optimism-kovan',
    title: 'Optimism Kovan',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM_KOVAN}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Optimism Kovan)',
      rootUrl: 'https://kovan-optimistic.etherscan.io/'
    },
    nativeToken: {
      symbol: 'kETH',
      name: 'Kovan Ether',
      decimals: 18
    },
    deprecated: true
  },
  [ChainId.OPTIMISM_GOERLI]: {
    chainId: ChainId.OPTIMISM_GOERLI,
    type: NetworkType.TESTNET,
    name: 'optimism-goerli',
    title: 'Optimism Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM_GOERLI}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Optimism Goerli)',
      rootUrl: 'https://goerli-optimistic.etherscan.io/'
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18
    },
    deprecated: true
  },
  [ChainId.OPTIMISM_SEPOLIA]: {
    chainId: ChainId.OPTIMISM_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'optimism-sepolia',
    title: 'Optimism Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.OPTIMISM_SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Etherscan (Optimism Sepolia)',
      rootUrl: 'https://sepolia-optimistic.etherscan.io/'
    },
    nativeToken: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18
    }
  },
  [ChainId.ARBITRUM]: {
    chainId: ChainId.ARBITRUM,
    type: NetworkType.MAINNET,
    name: 'arbitrum',
    title: 'Arbitrum One',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM}.webp`,
    blockExplorer: {
      name: 'Arbiscan',
      rootUrl: 'https://arbiscan.io/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.ARBITRUM_GOERLI]: {
    chainId: ChainId.ARBITRUM_GOERLI,
    type: NetworkType.TESTNET,
    name: 'arbitrum-goerli',
    title: 'Arbitrum Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM_GOERLI}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Arbiscan (Goerli Testnet)',
      rootUrl: 'https://testnet.arbiscan.io/'
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18
    },
    deprecated: true
  },
  [ChainId.ARBITRUM_SEPOLIA]: {
    chainId: ChainId.ARBITRUM_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'arbitrum-sepolia',
    title: 'Arbitrum Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM_SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Arbiscan (Sepolia Testnet)',
      rootUrl: 'https://sepolia.arbiscan.io/'
    },
    nativeToken: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18
    }
  },
  [ChainId.ARBITRUM_NOVA]: {
    chainId: ChainId.ARBITRUM_NOVA,
    type: NetworkType.MAINNET,
    name: 'arbitrum-nova',
    title: 'Arbitrum Nova',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ARBITRUM_NOVA}.webp`,
    blockExplorer: {
      name: 'Arbiscan Nova',
      rootUrl: 'https://nova.arbiscan.io/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.AVALANCHE]: {
    chainId: ChainId.AVALANCHE,
    type: NetworkType.MAINNET,
    name: 'avalanche',
    title: 'Avalanche',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.AVALANCHE}.webp`,
    blockExplorer: {
      name: 'Snowtrace',
      rootUrl: 'https://subnets.avax.network/c-chain/'
    },
    nativeToken: {
      symbol: 'AVAX',
      name: 'AVAX',
      decimals: 18
    }
  },
  [ChainId.AVALANCHE_TESTNET]: {
    chainId: ChainId.AVALANCHE_TESTNET,
    type: NetworkType.TESTNET,
    name: 'avalanche-testnet',
    title: 'Avalanche Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.AVALANCHE_TESTNET}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Snowtrace (Testnet)',
      rootUrl: 'https://subnets-test.avax.network/c-chain/'
    },
    nativeToken: {
      symbol: 'tAVAX',
      name: 'Testnet AVAX',
      decimals: 18
    }
  },
  [ChainId.GNOSIS]: {
    chainId: ChainId.GNOSIS,
    type: NetworkType.MAINNET,
    name: 'gnosis',
    title: 'Gnosis Chain',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.GNOSIS}.webp`,
    blockExplorer: {
      name: 'Gnosis Chain Explorer',
      rootUrl: 'https://blockscout.com/xdai/mainnet/'
    },
    nativeToken: {
      symbol: 'XDAI',
      name: 'XDAI',
      decimals: 18
    }
  },
  [ChainId.BASE]: {
    chainId: ChainId.BASE,
    type: NetworkType.MAINNET,
    name: 'base',
    title: 'Base (Coinbase)',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BASE}.webp`,
    blockExplorer: {
      name: 'Base Explorer',
      rootUrl: 'https://basescan.org/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.BASE_GOERLI]: {
    chainId: ChainId.BASE_GOERLI,
    type: NetworkType.TESTNET,
    name: 'base-goerli',
    title: 'Base Goerli',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BASE_GOERLI}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Base Goerli Explorer',
      rootUrl: 'https://goerli.basescan.org/'
    },
    nativeToken: {
      symbol: 'gETH',
      name: 'Goerli Ether',
      decimals: 18
    },
    deprecated: true
  },
  [ChainId.BASE_SEPOLIA]: {
    chainId: ChainId.BASE_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'base-sepolia',
    title: 'Base Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BASE_SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Base Sepolia Explorer',
      rootUrl: 'https://base-sepolia.blockscout.com/'
    },
    nativeToken: {
      symbol: 'sETH',
      name: 'Sepolia Ether',
      decimals: 18
    }
  },
  [ChainId.HOMEVERSE]: {
    chainId: ChainId.HOMEVERSE,
    type: NetworkType.MAINNET,
    name: 'homeverse',
    title: 'Oasys Homeverse',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.HOMEVERSE}.webp`,
    blockExplorer: {
      name: 'Oasys Homeverse Explorer',
      rootUrl: 'https://explorer.oasys.homeverse.games/'
    },
    nativeToken: {
      symbol: 'OAS',
      name: 'OAS',
      decimals: 18
    }
  },
  [ChainId.HOMEVERSE_TESTNET]: {
    chainId: ChainId.HOMEVERSE_TESTNET,
    type: NetworkType.TESTNET,
    name: 'homeverse-testnet',
    title: 'Oasys Homeverse Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.HOMEVERSE_TESTNET}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Oasys Homeverse Explorer (Testnet)',
      rootUrl: 'https://explorer.testnet.oasys.homeverse.games/'
    },
    nativeToken: {
      symbol: 'tOAS',
      name: 'Testnet OAS',
      decimals: 18
    }
  },
  [ChainId.XAI]: {
    chainId: ChainId.XAI,
    type: NetworkType.MAINNET,
    name: 'xai',
    title: 'Xai',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.XAI}.webp`,
    blockExplorer: {
      name: 'Xai Explorer',
      rootUrl: 'https://explorer.xai-chain.net/'
    },
    nativeToken: {
      symbol: 'XAI',
      name: 'XAI',
      decimals: 18
    }
  },
  [ChainId.XAI_SEPOLIA]: {
    chainId: ChainId.XAI_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'xai-sepolia',
    title: 'Xai Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.XAI_SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Xai Sepolia Explorer',
      rootUrl: 'https://testnet-explorer-v2.xai-chain.net/'
    },
    nativeToken: {
      symbol: 'sXAI',
      name: 'Sepolia XAI',
      decimals: 18
    }
  },
  [ChainId.ASTAR_ZKEVM]: {
    chainId: ChainId.ASTAR_ZKEVM,
    type: NetworkType.MAINNET,
    name: 'astar-zkevm',
    title: 'Astar zkEVM',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ASTAR_ZKEVM}.webp`,
    blockExplorer: {
      name: 'Astar zkEVM Explorer',
      rootUrl: 'https://astar-zkevm.explorer.startale.com/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.ASTAR_ZKYOTO]: {
    chainId: ChainId.ASTAR_ZKYOTO,
    type: NetworkType.TESTNET,
    name: 'astar-zkyoto',
    title: 'Astar zKyoto Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.ASTAR_ZKYOTO}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Astar zKyoto Explorer',
      rootUrl: 'https://astar-zkyoto.blockscout.com/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.XR_SEPOLIA]: {
    chainId: ChainId.XR_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'xr-sepolia',
    title: 'XR Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.XR_SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'XR Sepolia Explorer',
      rootUrl: 'https://xr-sepolia-testnet.explorer.caldera.xyz/'
    },
    nativeToken: {
      symbol: 'tXR',
      name: 'Sepolia XR',
      decimals: 18
    }
  },
  [ChainId.B3_SEPOLIA]: {
    chainId: ChainId.B3_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'b3-sepolia',
    title: 'B3 Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.B3_SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'B3 Sepolia Explorer',
      rootUrl: 'https://sepolia.explorer.b3.fun/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.APECHAIN_TESTNET]: {
    chainId: ChainId.APECHAIN_TESTNET,
    type: NetworkType.TESTNET,
    name: 'apechain-testnet',
    title: 'APE Chain Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.APECHAIN_TESTNET}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'APE Chain Explorer',
      rootUrl: 'https://curtis.explorer.caldera.xyz/'
    },
    nativeToken: {
      symbol: 'APE',
      name: 'ApeCoin',
      decimals: 18
    }
  },
  [ChainId.BLAST]: {
    chainId: ChainId.BLAST,
    type: NetworkType.MAINNET,
    name: 'blast',
    title: 'Blast',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BLAST}.webp`,
    blockExplorer: {
      name: 'Blast Explorer',
      rootUrl: 'https://blastscan.io/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.BLAST_SEPOLIA]: {
    chainId: ChainId.BLAST_SEPOLIA,
    type: NetworkType.TESTNET,
    name: 'blast-sepolia',
    title: 'Blast Sepolia',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BLAST_SEPOLIA}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Blast Sepolia Explorer',
      rootUrl: 'https://sepolia.blastexplorer.io/'
    },
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.TELOS]: {
    chainId: ChainId.TELOS,
    type: NetworkType.MAINNET,
    name: 'telos',
    title: 'Telos',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.TELOS}.webp`,
    blockExplorer: {
      name: 'Telos Explorer',
      rootUrl: 'https://explorer.telos.net/network/'
    },
    nativeToken: {
      symbol: 'TLOS',
      name: 'TLOS',
      decimals: 18
    }
  },
  [ChainId.BORNE_TESTNET]: {
    chainId: ChainId.BORNE_TESTNET,
    type: NetworkType.TESTNET,
    name: 'borne-testnet',
    title: 'Borne Testnet',
    logoURI: `https://assets.sequence.info/images/networks/medium/${ChainId.BORNE_TESTNET}.webp`,
    testnet: true,
    blockExplorer: {
      name: 'Borne Testnet Explorer',
      rootUrl: 'https://subnets-test.avax.network/bornegfdn'
    },
    nativeToken: {
      symbol: 'BORNE',
      name: 'BORNE',
      decimals: 18
    }
  },
  [ChainId.HARDHAT]: {
    chainId: ChainId.HARDHAT,
    name: 'hardhat',
    title: 'Hardhat (local testnet)',
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [ChainId.HARDHAT_2]: {
    chainId: ChainId.HARDHAT_2,
    name: 'hardhat2',
    title: 'Hardhat (local testnet)',
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  }
}
