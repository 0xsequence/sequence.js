import { Relayer } from '@0xsequence/relayer'

export interface NetworkConfig {
  name: string
  chainId: number
  rpcUrl: string
  ensAddress?: string
  sidechains?: NetworkConfig[]
  isMainChain?: boolean
  isAuthChain?: boolean
  relayer?: Relayer
}

export type NetworkConfigs = {[key: string]: NetworkConfig}

export const ethereumNetworks: NetworkConfigs = {
  mainnet: {
    name: 'mainnet',
    chainId: 1,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  
  morden: {
    name: 'morden',
    chainId: 2,
    rpcUrl: ''
  },
  
  ropsten: {
    name: 'ropsten',
    chainId: 3,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  
  rinkeby: {
    name: 'rinkeby',
    chainId: 4,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  
  goerli: {
    name: 'goerli',
    chainId: 5,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },

  kovan: {
    name: 'kovan',
    chainId: 42,
    rpcUrl: ''
  },

  mumbai : {
    name: 'mumbai',
    chainId: 80001,
    rpcUrl: 'https://rpc-mumbai.matic.today'
  },   
  
  matic : {
    name: 'matic',
    chainId: 137,
    rpcUrl: 'https://rpc-mainnet.matic.network'
  }
}
