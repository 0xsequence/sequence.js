import * as erc5719 from './erc5719'
import * as erc1271 from './erc1271'
import * as erc6492 from './erc6492'
import * as factory from './factory'
import * as mainModule from './mainModule'
import * as mainModuleUpgradable from './mainModuleUpgradable'
import * as moduleHooks from './moduleHooks'
import * as sequenceUtils from './sequenceUtils'
import * as requireFreshSigner from './libs/requireFreshSigners'
import * as walletProxyHook from './walletProxyHook'

export const walletContracts = {
  erc6492,
  erc5719,
  erc1271,
  factory,
  mainModule,
  mainModuleUpgradable,
  moduleHooks,
  sequenceUtils,
  requireFreshSigner,
  walletProxyHook
}
