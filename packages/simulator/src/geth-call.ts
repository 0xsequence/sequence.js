import { ethers, toBigInt } from 'ethers'
import { BigIntish } from '@0xsequence/utils'

export async function gethCall(
  provider: ethers.JsonRpcProvider,
  transaction: ethers.TransactionRequest,
  block?: ethers.BlockTag,
  overrides?: Overrides
) {
  // const formatter = ethers.JsonRpcProvider.getFormatter()

  // TODOXXX review..
  // return provider.send('eth_call', [
  //   formatter.transactionRequest(transaction),
  //   formatter.blockTag(block ?? null),
  //   ...(overrides ? [formatOverrides(overrides)] : [])
  // ])

  return provider.send('eth_call', [transaction, block ?? 'latest', ...(overrides ? [formatOverrides(overrides)] : [])])
}

export interface Overrides {
  [address: string]: {
    balance?: BigIntish
    nonce?: BigIntish
    code?: ethers.BytesLike | number | bigint
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
      formatted[key] = {}

      try {
        for (const [overrideKey, overrideValue] of Object.entries(value as any)) {
          switch (overrideKey) {
            case 'balance':
            case 'nonce':
              formatted[key][overrideKey] = overrideValue ? toBigInt(overrideValue as any) : undefined
              break
            case 'code':
              formatted[key][overrideKey] = overrideValue ? ethers.hexlify(overrideValue as any) : undefined
              break
            case 'state':
            case 'stateDiff':
              formatted[key][overrideKey] = overrideValue ? formatStorageOverrides(overrideValue as any) : undefined
              break
          }
        }
      } catch {}
    }
  }

  return formatted
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
