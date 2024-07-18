import { ethers } from 'ethers'

export async function resolveArrayProperties<T>(object: Readonly<T> | Readonly<T>[]): Promise<T> {
  if (Array.isArray(object)) {
    // T must include array type
    return Promise.all(object.map(o => ethers.resolveProperties(o))) as any
  }

  return ethers.resolveProperties(object)
}

export async function findLatestLog(provider: ethers.Provider, filter: ethers.Filter): Promise<ethers.Log | undefined> {
  const toBlock = filter.toBlock === 'latest' ? await provider.getBlockNumber() : (filter.toBlock as number)
  const fromBlock = filter.fromBlock as number

  try {
    const logs = await provider.getLogs({ ...filter, toBlock: toBlock })
    return logs.length === 0 ? undefined : logs[logs.length - 1]
  } catch (e) {
    // TODO Don't assume all errors are bad
    const pivot = Math.floor((toBlock - fromBlock) / 2 + fromBlock)
    const nhalf = await findLatestLog(provider, { ...filter, fromBlock: pivot, toBlock: toBlock })
    if (nhalf !== undefined) return nhalf
    return findLatestLog(provider, { ...filter, fromBlock: fromBlock, toBlock: pivot })
  }
}
