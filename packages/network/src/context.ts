// WalletContext is the module addresses deployed on a network, aka the context / environment
// of the Sequence Smart Wallet system on Ethereum.
export interface WalletContext {
  factory: string
  mainModule: string
  mainModuleUpgradable: string
  guestModule?: string
  sequenceUtils?: string

  libs?: {
    requireFreshSigner?: string
  }

  nonStrict?: boolean
}

// sequenceContext are the deployed addresses of modules available on public networks.
export const sequenceContext: WalletContext = {
  factory: '0xf9D09D634Fb818b05149329C1dcCFAeA53639d96',
  mainModule: '0xd01F11855bCcb95f88D7A48492F66410d4637313',
  mainModuleUpgradable: '0x7EFE6cE415956c5f80C6530cC6cc81b4808F6118',
  guestModule: '0x02390F3E6E5FD1C6786CB78FD3027C117a9955A7',
  sequenceUtils: '0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E',
  libs: {
    requireFreshSigner: '0xE6B9B21C077F382333220a072e4c44280b873907'
  }
}
