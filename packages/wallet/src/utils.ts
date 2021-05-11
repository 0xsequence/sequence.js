import { ethers, BytesLike, BigNumberish } from 'ethers'
import { Deferrable, resolveProperties } from '@ethersproject/properties'

export async function resolveArrayProperties<T>(object: Readonly<Deferrable<T>> | Readonly<Deferrable<T>>[]): Promise<T> {
  if (Array.isArray(object)) {
    // T must include array type
    return Promise.all(object.map((o) => resolveProperties(o))) as any
  }

  return resolveProperties(object)
}

export async function findLatestLog(provider: ethers.providers.Provider, filter: ethers.providers.Filter): Promise<ethers.providers.Log | undefined> {
  const toBlock = filter.toBlock === 'latest' ? await provider.getBlockNumber() : filter.toBlock as number
  const fromBlock = filter.fromBlock as number

  try {
    const logs = await provider.getLogs({ ...filter, toBlock: toBlock })
    return logs.length === 0 ? undefined : logs[logs.length - 1]
  } catch (e) {
    // TODO Don't assume all errors are bad
    const pivot = Math.floor(((toBlock - fromBlock) / 2) + fromBlock)
    const nhalf = await findLatestLog(provider, { ...filter, fromBlock: pivot, toBlock: toBlock })
    if (nhalf !== undefined) return nhalf
    return findLatestLog(provider, { ...filter, fromBlock: fromBlock, toBlock: pivot })
  }
}
