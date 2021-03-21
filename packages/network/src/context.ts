// WalletContext is the module addresses deployed on a network, aka the context / environment
// of the Sequence Smart Wallet system on Ethereum.
export interface WalletContext {
  factory: string
  mainModule: string
  mainModuleUpgradable: string
  guestModule?: string
  sequenceUtils?: string

  nonStrict?: boolean
}

// sequenceContext are the deployed addresses of modules available on public networks.
export const sequenceContext: WalletContext = {
  factory: '0x73025F64A80f5DF7f86b80c597Bc96DdfAdae072',
  mainModule: '0x52080556206Ecc3953BA6e280eb1a26b63692829',
  mainModuleUpgradable: '0x7520d4b8835CD394ed5BDAa903BD732f5991BF5B',
  guestModule: '0x4CE2cf42F93afcdF5378DEAb5Cff011cBEAf309f',
  sequenceUtils: '0xCa731e0f33Afbcfa9363d6F7449d1f5447d10C80'
}
