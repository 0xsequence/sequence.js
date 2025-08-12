export type Network = {
  name: string
  rpc: string
  chainId: bigint
  explorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

// Helper function to create RPC URL for a network
function getRpcUrl(networkName: string): string {
  return `https://nodes.sequence.app/${networkName}`
}

export const Mainnet: Network = {
  name: 'mainnet',
  rpc: getRpcUrl('mainnet'),
  chainId: 1n,
  explorer: 'https://etherscan.io/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const Sepolia: Network = {
  name: 'sepolia',
  rpc: getRpcUrl('sepolia'),
  chainId: 11155111n,
  explorer: 'https://sepolia.etherscan.io/',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'sETH',
    decimals: 18,
  },
}

export const Polygon: Network = {
  name: 'polygon',
  rpc: getRpcUrl('polygon'),
  chainId: 137n,
  explorer: 'https://polygonscan.com/',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
}

export const PolygonAmoy: Network = {
  name: 'amoy',
  rpc: getRpcUrl('amoy'),
  chainId: 80002n,
  explorer: 'https://www.oklink.com/amoy/',
  nativeCurrency: {
    name: 'Amoy POL',
    symbol: 'aPOL',
    decimals: 18,
  },
}

export const PolygonZkEVM: Network = {
  name: 'polygon-zkevm',
  rpc: getRpcUrl('polygon-zkevm'),
  chainId: 1101n,
  explorer: 'https://zkevm.polygonscan.com/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const BSC: Network = {
  name: 'bsc',
  rpc: getRpcUrl('bsc'),
  chainId: 56n,
  explorer: 'https://bscscan.com/',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
}

export const BSCTestnet: Network = {
  name: 'bsc-testnet',
  rpc: getRpcUrl('bsc-testnet'),
  chainId: 97n,
  explorer: 'https://testnet.bscscan.com/',
  nativeCurrency: {
    name: 'Testnet BNB',
    symbol: 'tBNB',
    decimals: 18,
  },
}

export const Optimism: Network = {
  name: 'optimism',
  rpc: getRpcUrl('optimism'),
  chainId: 10n,
  explorer: 'https://optimistic.etherscan.io/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const OptimismSepolia: Network = {
  name: 'optimism-sepolia',
  rpc: getRpcUrl('optimism-sepolia'),
  chainId: 11155420n,
  explorer: 'https://sepolia-optimistic.etherscan.io/',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'sETH',
    decimals: 18,
  },
}

export const Arbitrum: Network = {
  name: 'arbitrum',
  rpc: getRpcUrl('arbitrum'),
  chainId: 42161n,
  explorer: 'https://arbiscan.io/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const ArbitrumSepolia: Network = {
  name: 'arbitrum-sepolia',
  rpc: getRpcUrl('arbitrum-sepolia'),
  chainId: 421614n,
  explorer: 'https://sepolia.arbiscan.io/',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'sETH',
    decimals: 18,
  },
}

export const ArbitrumNova: Network = {
  name: 'arbitrum-nova',
  rpc: getRpcUrl('arbitrum-nova'),
  chainId: 42170n,
  explorer: 'https://nova.arbiscan.io/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const Avalanche: Network = {
  name: 'avalanche',
  rpc: getRpcUrl('avalanche'),
  chainId: 43114n,
  explorer: 'https://subnets.avax.network/c-chain/',
  nativeCurrency: {
    name: 'AVAX',
    symbol: 'AVAX',
    decimals: 18,
  },
}

export const AvalancheTestnet: Network = {
  name: 'avalanche-testnet',
  rpc: getRpcUrl('avalanche-testnet'),
  chainId: 43113n,
  explorer: 'https://subnets-test.avax.network/c-chain/',
  nativeCurrency: {
    name: 'Testnet AVAX',
    symbol: 'tAVAX',
    decimals: 18,
  },
}

export const Gnosis: Network = {
  name: 'gnosis',
  rpc: getRpcUrl('gnosis'),
  chainId: 100n,
  explorer: 'https://blockscout.com/xdai/mainnet/',
  nativeCurrency: {
    name: 'XDAI',
    symbol: 'XDAI',
    decimals: 18,
  },
}

export const Base: Network = {
  name: 'base',
  rpc: getRpcUrl('base'),
  chainId: 8453n,
  explorer: 'https://basescan.org/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const BaseSepolia: Network = {
  name: 'base-sepolia',
  rpc: getRpcUrl('base-sepolia'),
  chainId: 84532n,
  explorer: 'https://base-sepolia.blockscout.com/',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'sETH',
    decimals: 18,
  },
}

export const Homeverse: Network = {
  name: 'homeverse',
  rpc: getRpcUrl('homeverse'),
  chainId: 19011n,
  explorer: 'https://explorer.oasys.homeverse.games/',
  nativeCurrency: {
    name: 'OAS',
    symbol: 'OAS',
    decimals: 18,
  },
}

export const HomeverseTestnet: Network = {
  name: 'homeverse-testnet',
  rpc: getRpcUrl('homeverse-testnet'),
  chainId: 40875n,
  explorer: 'https://explorer.testnet.oasys.homeverse.games/',
  nativeCurrency: {
    name: 'Testnet OAS',
    symbol: 'tOAS',
    decimals: 18,
  },
}

export const Xai: Network = {
  name: 'xai',
  rpc: getRpcUrl('xai'),
  chainId: 660279n,
  explorer: 'https://explorer.xai-chain.net/',
  nativeCurrency: {
    name: 'XAI',
    symbol: 'XAI',
    decimals: 18,
  },
}

export const XaiSepolia: Network = {
  name: 'xai-sepolia',
  rpc: getRpcUrl('xai-sepolia'),
  chainId: 37714555429n,
  explorer: 'https://testnet-explorer-v2.xai-chain.net/',
  nativeCurrency: {
    name: 'Sepolia XAI',
    symbol: 'sXAI',
    decimals: 18,
  },
}

export const Telos: Network = {
  name: 'telos',
  rpc: getRpcUrl('telos'),
  chainId: 40n,
  explorer: 'https://explorer.telos.net/network/',
  nativeCurrency: {
    name: 'TLOS',
    symbol: 'TLOS',
    decimals: 18,
  },
}

export const TelosTestnet: Network = {
  name: 'telos-testnet',
  rpc: getRpcUrl('telos-testnet'),
  chainId: 41n,
  explorer: 'https://explorer-test.telos.net/network',
  nativeCurrency: {
    name: 'TLOS',
    symbol: 'TLOS',
    decimals: 18,
  },
}

export const B3: Network = {
  name: 'b3',
  rpc: getRpcUrl('b3'),
  chainId: 8333n,
  explorer: 'https://explorer.b3.fun/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const B3Sepolia: Network = {
  name: 'b3-sepolia',
  rpc: getRpcUrl('b3-sepolia'),
  chainId: 1993n,
  explorer: 'https://sepolia.explorer.b3.fun/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const ApeChain: Network = {
  name: 'apechain',
  rpc: getRpcUrl('apechain'),
  chainId: 33139n,
  explorer: 'https://apechain.calderaexplorer.xyz/',
  nativeCurrency: {
    name: 'ApeCoin',
    symbol: 'APE',
    decimals: 18,
  },
}

export const ApeChainTestnet: Network = {
  name: 'apechain-testnet',
  rpc: getRpcUrl('apechain-testnet'),
  chainId: 33111n,
  explorer: 'https://curtis.explorer.caldera.xyz/',
  nativeCurrency: {
    name: 'ApeCoin',
    symbol: 'APE',
    decimals: 18,
  },
}

export const Blast: Network = {
  name: 'blast',
  rpc: getRpcUrl('blast'),
  chainId: 81457n,
  explorer: 'https://blastscan.io/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const BlastSepolia: Network = {
  name: 'blast-sepolia',
  rpc: getRpcUrl('blast-sepolia'),
  chainId: 168587773n,
  explorer: 'https://sepolia.blastexplorer.io/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const BorneTestnet: Network = {
  name: 'borne-testnet',
  rpc: getRpcUrl('borne-testnet'),
  chainId: 94984n,
  explorer: 'https://subnets-test.avax.network/bornegfdn',
  nativeCurrency: {
    name: 'BORNE',
    symbol: 'BORNE',
    decimals: 18,
  },
}

export const SkaleNebula: Network = {
  name: 'skale-nebula',
  rpc: getRpcUrl('skale-nebula'),
  chainId: 1482601649n,
  explorer: 'https://green-giddy-denebola.explorer.mainnet.skalenodes.com/',
  nativeCurrency: {
    name: 'SKALE Fuel',
    symbol: 'sFUEL',
    decimals: 18,
  },
}

export const SkaleNebulaTestnet: Network = {
  name: 'skale-nebula-testnet',
  rpc: getRpcUrl('skale-nebula-testnet'),
  chainId: 37084624n,
  explorer: 'https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com/',
  nativeCurrency: {
    name: 'SKALE Fuel',
    symbol: 'sFUEL',
    decimals: 18,
  },
}

export const Soneium: Network = {
  name: 'soneium',
  rpc: getRpcUrl('soneium'),
  chainId: 1868n,
  explorer: 'https://soneium.blockscout.com/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const SoneiumMinato: Network = {
  name: 'soneium-minato',
  rpc: getRpcUrl('soneium-minato'),
  chainId: 1946n,
  explorer: 'https://explorer-testnet.soneium.org/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const ToyTestnet: Network = {
  name: 'toy-testnet',
  rpc: getRpcUrl('toy-testnet'),
  chainId: 21000000n,
  explorer: 'https://toy-chain-testnet.explorer.caldera.xyz/',
  nativeCurrency: {
    name: 'TOY',
    symbol: 'TOY',
    decimals: 18,
  },
}

export const ImmutableZkEVM: Network = {
  name: 'immutable-zkevm',
  rpc: getRpcUrl('immutable-zkevm'),
  chainId: 13371n,
  explorer: 'https://explorer.immutable.com/',
  nativeCurrency: {
    name: 'IMX',
    symbol: 'IMX',
    decimals: 18,
  },
}

export const ImmutableZkEVMTestnet: Network = {
  name: 'immutable-zkevm-testnet',
  rpc: getRpcUrl('immutable-zkevm-testnet'),
  chainId: 13473n,
  explorer: 'https://explorer.testnet.immutable.com/',
  nativeCurrency: {
    name: 'IMX',
    symbol: 'IMX',
    decimals: 18,
  },
}

export const RootNetwork: Network = {
  name: 'rootnet',
  rpc: getRpcUrl('rootnet'),
  chainId: 7668n,
  explorer: 'https://rootscan.io/',
  nativeCurrency: {
    name: 'XRP',
    symbol: 'XRP',
    decimals: 18,
  },
}

export const RootNetworkPorcini: Network = {
  name: 'rootnet-porcini',
  rpc: getRpcUrl('rootnet-porcini'),
  chainId: 7672n,
  explorer: 'https://porcini.rootscan.io/',
  nativeCurrency: {
    name: 'XRP',
    symbol: 'XRP',
    decimals: 18,
  },
}

export const Laos: Network = {
  name: 'laos',
  rpc: getRpcUrl('laos'),
  chainId: 6283n,
  explorer: 'https://blockscout.laos.laosfoundation.io/',
  nativeCurrency: {
    name: 'LAOS',
    symbol: 'LAOS',
    decimals: 18,
  },
}

export const LaosSigmaTestnet: Network = {
  name: 'laos-sigma-testnet',
  rpc: getRpcUrl('laos-sigma-testnet'),
  chainId: 62850n,
  explorer: 'https://sigma.explorer.laosnetwork.io/',
  nativeCurrency: {
    name: 'SIGMA',
    symbol: 'SIGMA',
    decimals: 18,
  },
}

export const Moonbeam: Network = {
  name: 'moonbeam',
  rpc: getRpcUrl('moonbeam'),
  chainId: 1284n,
  explorer: 'https://moonscan.io/',
  nativeCurrency: {
    name: 'GLMR',
    symbol: 'GLMR',
    decimals: 18,
  },
}

export const MoonbaseAlpha: Network = {
  name: 'moonbase-alpha',
  rpc: getRpcUrl('moonbase-alpha'),
  chainId: 1287n,
  explorer: 'https://moonbase.moonscan.io/',
  nativeCurrency: {
    name: 'GLMR',
    symbol: 'GLMR',
    decimals: 18,
  },
}

export const Etherlink: Network = {
  name: 'etherlink',
  rpc: getRpcUrl('etherlink'),
  chainId: 42793n,
  explorer: 'https://explorer.etherlink.com/',
  nativeCurrency: {
    name: 'Tez',
    symbol: 'XTZ',
    decimals: 18,
  },
}

export const EtherlinkTestnet: Network = {
  name: 'etherlink-testnet',
  rpc: getRpcUrl('etherlink-testnet'),
  chainId: 128123n,
  explorer: 'https://testnet.explorer.etherlink.com/',
  nativeCurrency: {
    name: 'Tez',
    symbol: 'XTZ',
    decimals: 18,
  },
}

export const MonadTestnet: Network = {
  name: 'monad-testnet',
  rpc: getRpcUrl('monad-testnet'),
  chainId: 10143n,
  explorer: 'https://testnet.monadexplorer.com/',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
}

export const SomniaTestnet: Network = {
  name: 'somnia-testnet',
  rpc: getRpcUrl('somnia-testnet'),
  chainId: 50312n,
  explorer: 'https://somnia-testnet.socialscan.io/',
  nativeCurrency: {
    name: 'STT',
    symbol: 'STT',
    decimals: 18,
  },
}

export const FrequencyTestnet: Network = {
  name: 'frequency-testnet',
  rpc: getRpcUrl('frequency-testnet'),
  chainId: 53716n,
  explorer: 'https://explorer.frequency.zeeve.net/',
  nativeCurrency: {
    name: 'BERA',
    symbol: 'BERA',
    decimals: 18,
  },
}

export const All = [
  Mainnet,
  Sepolia,
  Polygon,
  PolygonAmoy,
  PolygonZkEVM,
  BSC,
  BSCTestnet,
  Optimism,
  OptimismSepolia,
  Arbitrum,
  ArbitrumSepolia,
  ArbitrumNova,
  Avalanche,
  AvalancheTestnet,
  Gnosis,
  Base,
  BaseSepolia,
  Homeverse,
  HomeverseTestnet,
  Xai,
  XaiSepolia,
  Telos,
  TelosTestnet,
  B3,
  B3Sepolia,
  ApeChain,
  ApeChainTestnet,
  Blast,
  BlastSepolia,
  BorneTestnet,
  SkaleNebula,
  SkaleNebulaTestnet,
  Soneium,
  SoneiumMinato,
  ToyTestnet,
  ImmutableZkEVM,
  ImmutableZkEVMTestnet,
  RootNetwork,
  RootNetworkPorcini,
  Laos,
  LaosSigmaTestnet,
  Moonbeam,
  MoonbaseAlpha,
  Etherlink,
  EtherlinkTestnet,
  MonadTestnet,
  SomniaTestnet,
  FrequencyTestnet,
]
