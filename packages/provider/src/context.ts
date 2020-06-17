import { ArcadeumContext, NetworkConfig } from './types'

export const WalletContext: ArcadeumContext = {
  factory: '0x52f0F4258c69415567b21dfF085C3fd5505D5155',
  mainModule: '0x57bA6Eb1ed6821Db7bC26C6714f093E2BCbea40F',
  mainModuleUpgradable: '0xF52136A04057d889CeBf9bCc2F3142965AeABc54',
  guestModule: '0xe076ad01F1eb18A8eF20bB64003DA4810a429a32'
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
  }
}
