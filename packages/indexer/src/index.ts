export * from './indexer.gen'

import { Indexer as IndexerRpc } from './indexer.gen'

// TODO: rename to SequenceIndexerNetworks
export enum SequenceIndexerServices {
  MAINNET = 'https://mainnet-indexer.sequence.app',

  POLYGON = 'https://polygon-indexer.sequence.app',
  POLYGON_MUMBAI = 'https://mumbai-indexer.sequence.app',
  
  POLYGON_ZKEVM = 'https://polygon-zkevm-indexer.sequence.app',

  ARBITRUM = 'https://arbitrum-indexer.sequence.app',
  ARBITRUM_NOVA = 'https://arbitrum-nova-indexer.sequence.app',

  OPTIMISM = 'https://optimism-indexer.sequence.app',
  AVALANCHE = 'https://avalanche-indexer.sequence.app',
  GNOSIS = 'https://gnosis-indexer.sequence.app',

  BSC = 'https://bsc-indexer.sequence.app',
  BSC_TESTNET = 'https://bsc-testnet-indexer.sequence.app',

  GOERLI = 'https://goerli-indexer.sequence.app'
}

const fetch = typeof global === 'object' ? global.fetch : window.fetch

export class SequenceIndexerClient extends IndexerRpc {
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
