import * as abi from '@0xsequence/abi'
import * as api from '@0xsequence/api'
import * as auth from '@0xsequence/auth'
import * as chaind from '@0xsequence/chaind'
import * as config from '@0xsequence/config'
import * as guard from '@0xsequence/guard'
import * as multicall from '@0xsequence/multicall'
import * as network from '@0xsequence/network'
import * as provider from '@0xsequence/provider'
import * as relayer from '@0xsequence/relayer'
import * as transactions from '@0xsequence/transactions'
import * as _utils from '@0xsequence/utils'

// pkg-level export of 0xsequence/provider for easier consumption
import { Wallet } from '@0xsequence/provider'

// utility methods
// TODO: add util methods from @0xsequence/wallet to utils
const utils = {
  ..._utils
}

// sequence meta-package
export const sequence = {
  abi,
  api,
  auth,
  chaind,
  config,
  guard,
  multicall,
  network,
  provider,
  relayer,
  transactions,
  utils,

  Wallet
}

export { Wallet }
