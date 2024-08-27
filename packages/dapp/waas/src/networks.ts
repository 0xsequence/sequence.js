import { networks, ChainId } from '@0xsequence/network'

const RPC_BASE = 'https://nodes.sequence.app/'

const nameToId = Object.entries(networks).reduce(
  (acc, [key, value]) => {
    acc[value.name] = value.chainId
    return acc
  },
  {} as { [name: string]: (typeof networks)[ChainId.MAINNET]['chainId'] }
)

type NameToIdType = typeof nameToId
type IdToNameType = { [K in keyof NameToIdType as NameToIdType[K]]: K }

const idToName = Object.entries(nameToId).reduce((acc, [key, value]) => {
  acc[value] = key as any
  return acc
}, {} as IdToNameType)

export type SimpleNetwork = keyof NameToIdType | keyof IdToNameType

export function isSimpleNetwork(network: any): network is SimpleNetwork {
  return toNetworkID(network) in nameToId
}

export function toNetworkID(network: SimpleNetwork): keyof IdToNameType {
  const networkNumber = typeof network === 'number' ? network : parseInt(network)
  if (networkNumber in idToName) {
    return networkNumber
  }

  const networkLower = network.toString().toLowerCase()
  if (networkLower in nameToId) {
    return nameToId[networkLower as keyof NameToIdType]
  }

  throw new Error(`Unknown network: ${network}`)
}

export function nameOfNetwork(network: SimpleNetwork): keyof NameToIdType {
  return idToName[toNetworkID(network)]
}

export function rpcNode(network: SimpleNetwork): string {
  return RPC_BASE + nameOfNetwork(network)
}

export type WithSimpleNetwork<T> = Omit<T, 'chainId' | 'wallet'> & { network?: SimpleNetwork }
