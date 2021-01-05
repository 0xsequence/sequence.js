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
  factory: '0x878C961C6da18574e5a09069E541bDb6627eA65c',
  mainModule: '0x444C9327FF4e8fbF109ed6d22B96F83bb3cf3A06',
  mainModuleUpgradable: '0xCdB2f31BCe8c41E731c88BCB14A6692AC09e1C6e',
  guestModule: '0x0aA220BAdC3FD541b68A811bc46198Eadfc7A162',
  sequenceUtils: '0xc7406c1556859C567C06f2b8A9356B9D83dfB341'
}
