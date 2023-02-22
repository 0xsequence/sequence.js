export * from './api.gen'

import { API as ApiRpc } from './api.gen'

const fetch = typeof global === 'object' ? global.fetch : window.fetch

export class SequenceAPIClient extends ApiRpc {
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
