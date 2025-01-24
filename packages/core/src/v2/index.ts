import { WalletContext } from '../commons/context'

export * as config from './config'
export * as signature from './signature'
export * as context from './context'
export * as chained from './chained'

import { ConfigCoder } from './config'
import { SignatureCoder } from './signature'

export const coders = {
  config: ConfigCoder,
  signature: SignatureCoder
}

export const version = 2

export const DeployedWalletContext: WalletContext = {
  version: version,
  factory: '0xFaA5c0b14d1bED5C888Ca655B9a8A5911F78eF4A',
  guestModule: '0xfea230Ee243f88BC698dD8f1aE93F8301B6cdfaE',
  mainModule: '0xfBf8f1A5E00034762D928f46d438B947f5d4065d',
  mainModuleUpgradable: '0x4222dcA3974E39A8b41c411FeDDE9b09Ae14b911',
  walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3',
  proxyImplementationHook: '0x1f56dbAD5e8319F0DE9a323E24A31b5077dEB1a4'
}
