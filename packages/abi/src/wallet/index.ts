import * as erc1271 from './erc1271'
import * as factory from './factory'
import * as mainModule from './mainModule'
import * as mainModuleUpgradable from './mainModuleUpgradable'
import * as sequenceUtils from './sequenceUtils'
import * as requireFreshSigner from './libs/requireFreshSigners'

export const walletContracts = {
  erc1271,
  factory,
  mainModule,
  mainModuleUpgradable,
  sequenceUtils,
  requireFreshSigner
}
