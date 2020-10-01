import { ArcadeumContext, NetworkConfig } from './types'

export const WalletContext: ArcadeumContext = {
  factory: '0x29285b3B5bBCcC83F0C116311AbB93127d0f90Da',
  mainModule: '0x39BBffACb26C59810A522ae152C98Aef16AE4430',
  mainModuleUpgradable: '0xD6eA107eed2B292C3289e3a0788b2450287DcC73',
  guestModule: '0x62CAf680b06db2AaD4895504291B3Aa965C8f24c',
  requireUtils: '0xC58E02FC87d2d14A166597478e886e823C6430a1'
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
