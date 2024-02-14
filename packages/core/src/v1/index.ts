import { WalletContext } from '../commons/context'

export * as config from './config'
export * as context from './context'
export * as signature from './signature'

export const version = 1

export const DeployedWalletContext: WalletContext = {
  version: version,
  factory: '0xf9D09D634Fb818b05149329C1dcCFAeA53639d96',
  guestModule: '0x02390F3E6E5FD1C6786CB78FD3027C117a9955A7',
  mainModule: '0xd01F11855bCcb95f88D7A48492F66410d4637313',
  mainModuleUpgradable: '0x7EFE6cE415956c5f80C6530cC6cc81b4808F6118',
  walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'
}
