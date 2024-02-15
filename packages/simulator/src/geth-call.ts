import { ethers } from 'ethers'
import { BigIntish } from '@0xsequence/utils'

export async function gethCall(
  provider: ethers.JsonRpcProvider,
  transaction: ethers.TransactionRequest,
  block?: ethers.BlockTag,
  overrides?: Overrides
) {
  const formatter = ethers.JsonRpcProvider.getFormatter()

  return provider.send('eth_call', [
    formatter.transactionRequest(transaction),
    formatter.blockTag(block ?? null),
    ...(overrides ? [formatOverrides(overrides)] : [])
  ])
}

export interface Overrides {
  [address: string]: {
    balance?: BigIntish
    nonce?: BigIntish
    code?: ethers.BytesLike | ethers.Hexable | number | bigint
    state?: StorageOverrides
    stateDiff?: StorageOverrides
  }
}

export interface StorageOverrides {
  [hash: string]: string
}

function formatOverrides(overrides: any): Overrides {
  if (typeof overrides !== 'object') {
    throw new Error('overrides must be an object')
  }

  const formatted: Overrides = {}

  for (const [key, value] of Object.entries(overrides)) {
    if (ethers.isHexString(key, 20)) {
      try {
        formatted[key] = ethers.Formatter.check(overridesFormat, value)
      } catch {}
    }
  }

  return formatted
}

const overridesFormat = {
  balance: skipNullish(BigInt),
  nonce: skipNullish(BigInt),
  code: skipNullish(ethers.hexlify),
  state: skipNullish(formatStorageOverrides),
  stateDiff: skipNullish(formatStorageOverrides)
}

function formatStorageOverrides(overrides: any): StorageOverrides {
  if (typeof overrides !== 'object') {
    throw new Error('storage overrides must be an object')
  }

  const formatted: StorageOverrides = {}

  for (const [key, value] of Object.entries(overrides)) {
    if (ethers.isHexString(key, 32)) {
      try {
        const hash = ethers.hexlify(value as any)
        if (ethers.isHexString(hash, 32)) {
          formatted[key] = hash
        }
      } catch {}
    }
  }

  return formatted
}

function skipNullish<X, Y>(formatter: (x: X) => Y): (x?: X | null) => Y | undefined {
  return x => {
    switch (x) {
      case null:
      case undefined:
        return undefined

      default:
        return formatter(x)
    }
  }
}
