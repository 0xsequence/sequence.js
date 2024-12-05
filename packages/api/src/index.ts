export * from './api.gen'

import { API as ApiRpc } from './api.gen'

export class SequenceAPIClient extends ApiRpc {
  constructor(
    hostname: string,
    public projectAccessKey?: string,
    public jwtAuth?: string
  ) {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
    this.fetch = this._fetch
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    // automatically include jwt and access key auth header to requests
    // if its been set on the api client
    const headers: { [key: string]: any } = {}

    const jwtAuth = this.jwtAuth
    const projectAccessKey = this.projectAccessKey

    if (jwtAuth && jwtAuth.length > 0) {
      headers['Authorization'] = `BEARER ${jwtAuth}`
    }

    if (projectAccessKey && projectAccessKey.length > 0) {
      headers['X-Access-Key'] = projectAccessKey
    }

    // before the request is made
    init!.headers = { ...init!.headers, ...headers }

    return fetch(input, init)
  }
}
