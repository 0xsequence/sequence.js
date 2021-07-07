import { BigNumberish } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Relayer, RpcRelayerOptions } from '@0xsequence/relayer'
import { urlClean } from '@0xsequence/utils'
import { createNetworkConfig } from './utils'

export interface NetworkConfig {
  title?: string
  name: string
  chainId: number
  ensAddress?: string

  rpcUrl?: string
  provider?: JsonRpcProvider
  relayer?: Relayer | RpcRelayerOptions

  // TODO:
  // indexerUrl?: string
  // indexer?: Indexer

  // TODO: add list of bridges (and their respective configs) available
  // for a particular network
  // bridges?: any[]

  // isDefaultChain identifies the default network. For example, a dapp may run on the Matic
  // network and may configure the wallet to use it as its main/default chain.
  isDefaultChain?: boolean

  // isAuthChain identifies the network containing wallet config contents.
  isAuthChain?: boolean

  // optional sequence api service
  sequenceApiUrl?: string
}

export type Networks = NetworkConfig[]

export type ChainId = NetworkConfig | BigNumberish

export type NetworksBuilder = (vars: {[key: string]: any}) => Networks

export const mainnetNetworks = createNetworkConfig((vars: {[key: string]: any}) => [
  {
    title: 'Ethereum',
    name: 'mainnet',
    chainId: 1,
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    rpcUrl: urlClean(`${vars.baseRpcUrl}/mainnet`),
    relayer: { url: urlClean(`${vars.baseRelayerUrl}/mainnet`) },
    isDefaultChain: true
  },
  {
    title: 'Matic',
    name: 'matic',
    chainId: 137,
    rpcUrl: 'https://rpc-mainnet.matic.network',
    relayer: { url: urlClean(`${vars.baseRelayerUrl}/matic`) },
    isAuthChain: true
  }
], 1, {
  baseRpcUrl: 'https://nodes.sequence.app',
  baseRelayerUrl: 'https://relayers.sequence.app'
})

export const testnetNetworks = createNetworkConfig((vars: {[key: string]: any}) =>[
  {
    name: 'rinkeby',
    chainId: 4,
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    rpcUrl: urlClean(`${vars.baseRpcUrl}/rinkeby`),
    relayer: { url: urlClean(`${vars.baseRelayerUrl}/rinkeby`) },
    isDefaultChain: true
  },
  {
    name: 'goerli',
    chainId: 5,
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    rpcUrl: urlClean(`${vars.baseRpcUrl}/goerli`),
    relayer: { url: urlClean(`${vars.baseRelayerUrl}/goerli`) },
    isAuthChain: true
  },
  // {
  //   name: 'ropsten',
  //   chainId: 3,
  //   ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  //   rpcUrl: '',
  //   // relayer: null
  // },
  // {
  //   name: 'kovan',
  //   chainId: 42,
  //   rpcUrl: '',
  //   relayer: null
  // },
  // {
  //   name: 'mumbai',
  //   chainId: 80001,
  //   rpcUrl: 'https://rpc-mumbai.matic.today',
  //   relayer: null
  // }
], undefined, {
  baseRpcUrl: 'https://nodes.sequence.app',
  baseRelayerUrl: 'https://relayers.sequence.app'
})

// export const mainnetNetworksIndex = networksIndex(mainnetNetworks)

// export const testnetNetworksIndex = networksIndex(testnetNetworks)
