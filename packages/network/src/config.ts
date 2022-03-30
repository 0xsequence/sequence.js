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

  // Harmony ONE (ONE)
  HARMONY = 1666600000,
  HARMONY_TESTNET = 1666700000,

  // Aurora
  AURORA = 1313161554,
  AURORA_TESTNET = 1313161555
}

export interface NetworkConfig {
  title?: string
  name: string
  chainId: number
  ensAddress?: string
  testnet?: boolean

  rpcUrl?: string
  provider?: JsonRpcProvider
  indexerUrl?: string
  indexer?: Indexer
  relayer?: Relayer | RpcRelayerOptions

  // TODO: add list of bridges (and their respective configs) available
  // for a particular network
  // bridges?: any[]

  // isDefaultChain identifies the default network. For example, a dapp may run on the Polygon
  // network and may configure the wallet to use it as its main/default chain.
  isDefaultChain?: boolean

  // isAuthChain identifies the network containing wallet config contents.
  isAuthChain?: boolean
}

export type Networks = NetworkConfig[]

export type ChainIdLike = NetworkConfig | BigNumberish

export type NetworksBuilder = (vars: { [key: string]: any }) => Networks

export const mainnetNetworks = createNetworkConfig(
  (vars: { [key: string]: any }) => [
    {
      title: 'Ethereum',
      name: 'mainnet',
      chainId: ChainId.MAINNET,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      rpcUrl: urlClean(`${vars.baseRpcUrl}/mainnet`),
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/mainnet`) },
      isDefaultChain: true
    },
    {
      title: 'Polygon',
      name: 'polygon',
      chainId: ChainId.POLYGON,
      rpcUrl: 'https://rpc-mainnet.matic.network',
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/matic`) },
      isAuthChain: true
    },
    {
      title: 'Harmony',
      name: 'harmony',
      chainId: ChainId.HARMONY,
      rpcUrl: 'https://api.harmony.one'
    },
    {
      title: 'Aurora',
      name: 'aurora',
      chainId: ChainId.AURORA,
      rpcUrl: 'https://mainnet.aurora.dev',
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
      name: 'rinkeby',
      chainId: ChainId.RINKEBY,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      testnet: true,
      rpcUrl: urlClean(`${vars.baseRpcUrl}/rinkeby`),
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/rinkeby`) },
      isDefaultChain: true
    },
    {
      name: 'goerli',
      chainId: ChainId.GOERLI,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      testnet: true,
      rpcUrl: urlClean(`${vars.baseRpcUrl}/goerli`),
      relayer: { url: urlClean(`${vars.baseRelayerUrl}/goerli`) },
      isAuthChain: true
    },
    {
      title: 'Harmony',
      name: 'harmony',
      chainId: ChainId.HARMONY,
      rpcUrl: 'https://api.s0.b.hmny.io'
    },
    {
      title: 'Aurora',
      name: 'aurora',
      chainId: ChainId.AURORA,
      rpcUrl: 'https://testnet.aurora.dev'
    }
    // {
    //   name: 'ropsten',
    //   chainId: ChainId.ROPSTEN,
    //   ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    //   rpcUrl: '',
    //   // relayer: null
    // },
    // {
    //   name: 'kovan',
    //   chainId: ChainId.KOVAN,
    //   rpcUrl: '',
    //   relayer: null
    // },
    // {
    //   name: 'mumbai',
    //   chainId: ChainId.POLYGON_MUMBAI,
    //   rpcUrl: 'https://rpc-mumbai.matic.today',
    //   relayer: null
    // }
  ],
  undefined,
  {
    baseRpcUrl: 'https://nodes.sequence.app',
    baseRelayerUrl: 'https://relayers.sequence.app'
  }
)

// export const mainnetNetworksIndex = networksIndex(mainnetNetworks)

// export const testnetNetworksIndex = networksIndex(testnetNetworks)
