import { ChainId, NetworkConfig, NetworkMetadata } from '../../network/src'

export enum HardhatChainId {
  HARDHAT = 31337,
  HARDHAT_2 = 31338
}

export const hardhatNetworks: Record<HardhatChainId, NetworkMetadata> = {
  [HardhatChainId.HARDHAT]: {
    chainId: HardhatChainId.HARDHAT as any as ChainId,
    name: 'hardhat',
    title: 'Hardhat (local testnet)',
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  },
  [HardhatChainId.HARDHAT_2]: {
    chainId: HardhatChainId.HARDHAT_2 as any as ChainId,
    name: 'hardhat2',
    title: 'Hardhat (local testnet)',
    nativeToken: {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
  }
}

export const hardhatNetworkConfigs: NetworkConfig[] = [
  {
    ...hardhatNetworks[HardhatChainId.HARDHAT],
    rpcUrl: 'http://localhost:8545',
    relayer: {
      url: 'http://localhost:3000',
      provider: {
        url: 'http://localhost:8545'
      }
    }
  },
  {
    ...hardhatNetworks[HardhatChainId.HARDHAT_2],
    rpcUrl: 'http://localhost:9545',
    relayer: {
      url: 'http://localhost:3000',
      provider: {
        url: 'http://localhost:9545'
      }
    }
  }
]
