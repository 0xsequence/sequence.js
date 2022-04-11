export * from './indexer.gen'

import fetch from 'cross-fetch'

import { Indexer as BaseSequenceIndexer } from './indexer.gen'

export enum SequenceIndexerServices {
  MAINNET = 'https://mainnet-indexer.sequence.app',
  POLYGON = 'https://polygon-indexer.sequence.app',
  
  RINKEBY = 'https://rinkeby-indexer.sequence.app',
  POLYGON_MUMBAI = 'https://mumbai-indexer.sequence.app'
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
