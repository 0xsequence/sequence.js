export * from './indexer.gen'

import fetch from 'cross-fetch'

import { Indexer as BaseSequenceIndexer } from './indexer.gen'

export enum SequenceIndexerServices {
  MAINNET = 'https://mainnet-indexer.sequence.app',

  POLYGON = 'https://polygon-indexer.sequence.app',
  POLYGON_MUMBAI = 'https://mumbai-indexer.sequence.app',

  ARBITRUM = 'https://arbitrum-indexer.sequence.app',
  ARBITRUM_NOVA = 'https://arbitrum-nova-indexer.sequence.app',

  OPTIMISM = 'https://optimism-indexer.sequence.app',
  AVALANCHE = 'https://avalanche-indexer.sequence.app',
  GNOSIS = 'https://gnosis-indexer.sequence.app',

  BSC = 'https://bsc-indexer.sequence.app',
  BSC_TESTNET = 'https://bsc-testnet-indexer.sequence.app',

  GOERLI = 'https://goerli-indexer.sequence.app'
}

export class SequenceIndexerClient extends BaseSequenceIndexer {
  constructor(hostname: string, public jwtAuth?: string) {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
    this.fetch = this._fetch
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    // automatically include jwt auth header to requests
    // if its been set on the api client
    const headers: { [key: string]: any } = {}
    if (this.jwtAuth && this.jwtAuth.length > 0) {
      headers['Authorization'] = `BEARER ${this.jwtAuth}`
    }

    // before the request is made
    init!.headers = { ...init!.headers, ...headers }

    return fetch(input, init)
  }
}


// const SequenceIndexerServices: { [key: string]: string } = {}

// {
//   [ ...mainnetNetworks, ...testnetNetworks ].forEach(n => {
//     if (n.indexerUrl) {
//       SequenceIndexerServices[n.name.toUpperCase()] = n.indexerUrl
//     }
//   })
// }

// export { SequenceIndexerServices }