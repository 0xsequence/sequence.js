
const RPC_BASE = 'https://nodes.sequence.app/'

const nameToId = {
  'mainnet': 1,
  'goerli': 5,
  'polygon': 137,
  'polygon-zkevm': 1101,
  'mumbai': 80001,
  'bsc': 56,
  'bsc-testnet': 97,
  'arbitrum': 42161,
  'arbitrum-nova': 42170,
  'arbitrum-goerli': 421613,
  'optimism': 10,
  'gnosis': 100,
  'avalanche': 43114,
  'avalanche-testnet': 43113,
  'base-goerli': 84531,
}

type NameToIdType = typeof nameToId
type IdToNameType = { [K in keyof NameToIdType as NameToIdType[K]]: K }

const idToName = Object.entries(nameToId).reduce((acc, [key, value]) => {
  acc[value] = key as any; return acc
}, {} as IdToNameType)

export type SimpleNetwork = keyof NameToIdType | keyof IdToNameType

export function isSimpleNetwork(network: any): network is SimpleNetwork {
  return toNetworkID(network) in nameToId
}

export function toNetworkID(network: SimpleNetwork): keyof IdToNameType {
  if (typeof network === 'number') {
    if (network in idToName) {
      return network
    } else {
      throw new Error(`Unknown network id ${network}`)
    }
  }

  const networkLower = network.toLowerCase()
  if (networkLower in nameToId) {
    return nameToId[networkLower as keyof NameToIdType]
  } else {
    throw new Error(`Unknown network name ${network}`)
  }
}

export function nameOfNetwork(network: SimpleNetwork): keyof NameToIdType {
  return idToName[toNetworkID(network)]
}

export function rpcNode(network: SimpleNetwork): string {
  return RPC_BASE + nameOfNetwork(network)
}

export type WithSimpleNetwork<T> = Omit<T, 'chainId'> & { network?: SimpleNetwork }
