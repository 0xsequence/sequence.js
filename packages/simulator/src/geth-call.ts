import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { BytesLike, Hexable, hexlify, isHexString } from '@ethersproject/bytes'
import { BlockTag, Formatter, JsonRpcProvider, TransactionRequest } from '@ethersproject/providers'

export async function gethCall(
  provider: JsonRpcProvider,
  transaction: TransactionRequest,
  block?: BlockTag,
  overrides?: Overrides
) {
  const formatter = JsonRpcProvider.getFormatter()

  return provider.send('eth_call', [
    formatter.transactionRequest(transaction),
    formatter.blockTag(block ?? null),
    ...(overrides ? [formatOverrides(overrides)] : [])
  ])
}

export interface Overrides {
  [address: string]: {
    balance?: BigNumberish
    nonce?: BigNumberish
    code?: BytesLike | Hexable | number | bigint
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
    if (isHexString(key, 20)) {
      try {
        formatted[key] = Formatter.check(overridesFormat, value)
      } catch {}
    }
  }

  return formatted
}

const overridesFormat = {
  balance: skipNullish(BigNumber.from),
  nonce: skipNullish(BigNumber.from),
  code: skipNullish(hexlify),
  state: skipNullish(formatStorageOverrides),
  stateDiff: skipNullish(formatStorageOverrides)
}

function formatStorageOverrides(overrides: any): StorageOverrides {
  if (typeof overrides !== 'object') {
    throw new Error('storage overrides must be an object')
  }

  const formatted: StorageOverrides = {}

  for (const [key, value] of Object.entries(overrides)) {
    if (isHexString(key, 32)) {
      try {
        const hash = hexlify(value as any)
        if (isHexString(hash, 32)) {
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
