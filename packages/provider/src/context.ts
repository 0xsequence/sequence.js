import { ArcadeumContext, NetworkConfig } from './types'

export const WalletContext: ArcadeumContext = {
  factory: '0x52f0F4258c69415567b21dfF085C3fd5505D5155',
  mainModule: '0x621821390a694d4cBfc5892C52145B8D93ACcdEE',
  mainModuleUpgradable: '0xC7cE8a07f69F226E52AEfF57085d8C915ff265f7'
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
