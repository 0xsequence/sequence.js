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

export type Networks = {[key: string]: NetworkConfig}

export function isNetworkConfig(cand: any): cand is NetworkConfig {
  return cand && cand.chainId !== undefined
}

export const ethereumNetworks: Networks = {
  mainnet: {
    name: 'mainnet',
    chainId: 1,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    relayer: null
  },
  
  morden: {
    name: 'morden',
    chainId: 2,
    rpcUrl: '',
    relayer: null
  },
  
  ropsten: {
    name: 'ropsten',
    chainId: 3,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    relayer: null
  },
  
  rinkeby: {
    name: 'rinkeby',
    chainId: 4,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    relayer: null
  },
  
  goerli: {
    name: 'goerli',
    chainId: 5,
    rpcUrl: '',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    relayer: null
  },

  kovan: {
    name: 'kovan',
    chainId: 42,
    rpcUrl: '',
    relayer: null
  },

  mumbai : {
    name: 'mumbai',
    chainId: 80001,
    rpcUrl: 'https://rpc-mumbai.matic.today',
    relayer: null
  },   
  
  matic : {
    name: 'matic',
    chainId: 137,
    rpcUrl: 'https://rpc-mainnet.matic.network',
    relayer: null
  }
}
