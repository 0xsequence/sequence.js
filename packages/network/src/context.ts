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
  factory: '0x6813Da82a84e31f98824146a50d9Ba0Fbd4cbF14',
  mainModule: '0xBf7aa3d072d4052D894cDd32EC818B02D9ba4FeC',
  mainModuleUpgradable: '0xc97c6276702A89741F2313d2F8fC9C7D4dC86128',
  guestModule: '0xd1345a45Cc1Dc792389a85d722CB911118Bb52Ef',
  sequenceUtils: '0x6fA52553CCFB101f26d55a7342F84A10e1054E58'
}
