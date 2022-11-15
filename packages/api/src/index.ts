export * from './api.gen'

import { API as BaseSequenceAPI } from './api.gen'

export class SequenceAPIClient extends BaseSequenceAPI {
  constructor(hostname: string, public jwtAuth?: string) {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, global.fetch)
    this.fetch = (a, b) => this._fetch(a, b)
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
