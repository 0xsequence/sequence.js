import * as abi from '@0xsequence/abi'
import * as provider from '@0xsequence/provider'
import * as wallet from '@0xsequence/wallet'

export const sequence = {
  abi,
  provider,
  // ... etc.
}

// NOTE: 0xsequence top-level package will not export the entiure @0xsequence/wallet
// module, only utility methods.

// TODO: utils.recover, etc.. from 0xsequence/wallet
// TODO: for utils, included utils.typedData.encode(), etc..TypedDataUtils
// or typedData.XX at same level as utils
// or utils.wallet, utils.typedData, etc.

// pkg-level export of 0xsequence/provider for easier consumption
import { Wallet } from '@0xsequence/provider'

export {
  Wallet
  // etc.....
}
