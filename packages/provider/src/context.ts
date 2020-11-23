import { ArcadeumContext, NetworkConfig } from './types'

export const WalletContext: ArcadeumContext = {
  factory: '0x878C961C6da18574e5a09069E541bDb6627eA65c',
  mainModule: '0x444C9327FF4e8fbF109ed6d22B96F83bb3cf3A06',
  mainModuleUpgradable: '0xCdB2f31BCe8c41E731c88BCB14A6692AC09e1C6e',
  guestModule: '0x0aA220BAdC3FD541b68A811bc46198Eadfc7A162',
  requireUtils: '0xc7406c1556859C567C06f2b8A9356B9D83dfB341'
}

export const ethereumNetworks: {[key: string]: NetworkConfig} = {
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
