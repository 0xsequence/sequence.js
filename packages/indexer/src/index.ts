export * from './indexer.gen'

import fetch from 'cross-fetch'

import { Indexer as BaseSequenceIndexer } from './indexer.gen'

export class SequenceIndexerClient extends BaseSequenceIndexer {
  constructor(hostname: string, readonly chainId: number, public jwtAuth?: string) {
    super(hostname, fetch)
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
