import * as erc5719 from './erc5719.js'
import * as erc1271 from './erc1271.js'
import * as erc6492 from './erc6492.js'
import * as factory from './factory.js'
import * as mainModule from './mainModule.js'
import * as mainModuleUpgradable from './mainModuleUpgradable.js'
import * as moduleHooks from './moduleHooks.js'
import * as sequenceUtils from './sequenceUtils.js'
import * as requireFreshSigner from './libs/requireFreshSigners.js'
import * as walletProxyHook from './walletProxyHook.js'

/**
 * @deprecated import directly from @0xsequence/abi/* instead, omitting "walletContracts"
 */
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
  walletProxyHook,
}
