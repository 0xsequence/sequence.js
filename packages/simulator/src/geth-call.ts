import { BigNumber, BigNumberish, BytesLike, utils, providers } from 'ethers'

export async function gethCall(
  provider: providers.JsonRpcProvider,
  transaction: providers.TransactionRequest,
  block?: providers.BlockTag,
  overrides?: Overrides
) {
  const formatter = providers.JsonRpcProvider.getFormatter()

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
    code?: BytesLike | utils.Hexable | number | bigint
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
    if (utils.isHexString(key, 20)) {
      try {
        formatted[key] = providers.Formatter.check(overridesFormat, value)
      } catch {}
    }
  }

  return formatted
}

const overridesFormat = {
  balance: skipNullish(BigNumber.from),
  nonce: skipNullish(BigNumber.from),
  code: skipNullish(utils.hexlify),
  state: skipNullish(formatStorageOverrides),
  stateDiff: skipNullish(formatStorageOverrides)
}

function formatStorageOverrides(overrides: any): StorageOverrides {
  if (typeof overrides !== 'object') {
    throw new Error('storage overrides must be an object')
  }

  const formatted: StorageOverrides = {}

  for (const [key, value] of Object.entries(overrides)) {
    if (utils.isHexString(key, 32)) {
      try {
        const hash = utils.hexlify(value as any)
        if (utils.isHexString(hash, 32)) {
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
