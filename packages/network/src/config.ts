import { ethers } from 'ethers'
import { Indexer } from '@0xsequence/indexer'
import { Relayer, RpcRelayerOptions } from '@0xsequence/relayer'
import { findNetworkConfig, stringTemplate, validateAndSortNetworks } from './utils'
import { isBigNumberish } from '@0xsequence/utils'
import { ChainId, NetworkMetadata, networks } from './constants'

export type NetworkConfig = NetworkMetadata & {
  rpcUrl: string
  provider?: ethers.Provider
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

export type ChainIdLike = NetworkConfig | ethers.BigNumberish

export function toChainIdNumber(chainIdLike: ChainIdLike): bigint {
  if (typeof chainIdLike === 'bigint') {
    return chainIdLike
  }

  if (isBigNumberish(chainIdLike)) {
    return BigInt(chainIdLike)
  }

  return BigInt(chainIdLike.chainId)
}

const createNetworkConfig = (chainId: ChainId, options?: { disabled?: boolean }): NetworkConfig => {
  const network = networks[chainId]

  if (!network) {
    throw new Error(`Network with chainId ${chainId} not found`)
  }

  const rpcUrl = nodesURL(network.name)

  return {
    ...network,
    rpcUrl,
    indexerUrl: indexerURL(network.name),
    relayer: {
      url: relayerURL(network.name),
      provider: {
        url: rpcUrl
      }
    },
    ...options
  }
}

export const hardhatNetworks = [
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
]

export const allNetworks = validateAndSortNetworks([
  { ...createNetworkConfig(ChainId.POLYGON), isDefaultChain: true, isAuthChain: true } as LegacyNetworkConfig,
  createNetworkConfig(ChainId.MAINNET),
  createNetworkConfig(ChainId.BSC),
  createNetworkConfig(ChainId.AVALANCHE),
  createNetworkConfig(ChainId.ARBITRUM),
  createNetworkConfig(ChainId.ARBITRUM_NOVA),
  createNetworkConfig(ChainId.OPTIMISM),
  createNetworkConfig(ChainId.OPTIMISM_SEPOLIA),
  createNetworkConfig(ChainId.POLYGON_ZKEVM),
  createNetworkConfig(ChainId.GNOSIS),
  createNetworkConfig(ChainId.RINKEBY, { disabled: true }),
  createNetworkConfig(ChainId.GOERLI, { disabled: true }),
  createNetworkConfig(ChainId.SEPOLIA),
  createNetworkConfig(ChainId.POLYGON_MUMBAI, { disabled: true }),
  createNetworkConfig(ChainId.POLYGON_AMOY),
  createNetworkConfig(ChainId.BSC_TESTNET),
  createNetworkConfig(ChainId.ARBITRUM_SEPOLIA),
  createNetworkConfig(ChainId.BASE),
  createNetworkConfig(ChainId.BASE_SEPOLIA),
  createNetworkConfig(ChainId.HOMEVERSE),
  createNetworkConfig(ChainId.HOMEVERSE_TESTNET),
  createNetworkConfig(ChainId.XAI),
  createNetworkConfig(ChainId.XAI_SEPOLIA),
  createNetworkConfig(ChainId.AVALANCHE_TESTNET),
  createNetworkConfig(ChainId.B3),
  createNetworkConfig(ChainId.B3_SEPOLIA),
  createNetworkConfig(ChainId.APECHAIN),
  createNetworkConfig(ChainId.APECHAIN_TESTNET),
  createNetworkConfig(ChainId.BLAST),
  createNetworkConfig(ChainId.BLAST_SEPOLIA),
  createNetworkConfig(ChainId.TELOS),
  createNetworkConfig(ChainId.TELOS_TESTNET),
  createNetworkConfig(ChainId.BORNE_TESTNET),
  createNetworkConfig(ChainId.SKALE_NEBULA),
  createNetworkConfig(ChainId.SKALE_NEBULA_TESTNET),
  createNetworkConfig(ChainId.SONEIUM),
  createNetworkConfig(ChainId.SONEIUM_MINATO),
  createNetworkConfig(ChainId.TOY_TESTNET),
  createNetworkConfig(ChainId.IMMUTABLE_ZKEVM),
  createNetworkConfig(ChainId.IMMUTABLE_ZKEVM_TESTNET),
  createNetworkConfig(ChainId.MOONBEAM),
  createNetworkConfig(ChainId.MOONBASE_ALPHA),
  createNetworkConfig(ChainId.ETHERLINK),
  createNetworkConfig(ChainId.ETHERLINK_TESTNET, { disabled: true }),
  createNetworkConfig(ChainId.ETHERLINK_SHADOWNET_TESTNET),
  createNetworkConfig(ChainId.SOMNIA),
  createNetworkConfig(ChainId.SOMNIA_TESTNET),
  createNetworkConfig(ChainId.MONAD),
  createNetworkConfig(ChainId.MONAD_TESTNET),
  createNetworkConfig(ChainId.INCENTIV_TESTNET, { disabled: true }),
  createNetworkConfig(ChainId.INCENTIV_TESTNET_V2),
  createNetworkConfig(ChainId.INCENTIV),
  createNetworkConfig(ChainId.KATANA),
  createNetworkConfig(ChainId.SANDBOX_TESTNET),
  createNetworkConfig(ChainId.ARC_TESTNET),
  createNetworkConfig(ChainId.HYPEREVM),
  createNetworkConfig(ChainId.BERACHAIN),
  createNetworkConfig(ChainId.SONIC),
  ...hardhatNetworks
])
