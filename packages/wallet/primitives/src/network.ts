export type Network = {
  name: string
  rpc: string
  chainId: bigint
  explorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

export const Arbitrum: Network = {
  name: 'Arbitrum',
  rpc: 'https://nodes.sequence.app/arbitrum',
  chainId: 42161n,
  explorer: 'https://arbiscan.io/',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
}

export const All = [Arbitrum]
