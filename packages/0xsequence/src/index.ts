import * as abi from '@0xsequence/abi'
import * as provider from '@0xsequence/provider'
import * as wallet from '@0xsequence/wallet'

export const sequence = {
  abi,
  provider,
  wallet
  // ... etc.
}

// pkg-level export of 0xsequence/provider for easier consumption
import { Wallet } from '@0xsequence/provider'

export {
  Wallet
  // etc.....
}
