export * from './builder.gen'

import { Builder as BuilderRpc } from './builder.gen'

export class SequenceBuilderClient extends BuilderRpc {
  constructor(
    public projectAccessKey: string,
    apiUrl?: string
  ) {
    const hostname = apiUrl ?? 'https://api.sequence.build'
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
    this.fetch = this._fetch
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    // automatically include access key auth header to requests
    // if its been set on the api client
    const headers: { [key: string]: any } = {}

    const projectAccessKey = this.projectAccessKey
    if (projectAccessKey && projectAccessKey.length > 0) {
      headers['X-Access-Key'] = projectAccessKey
    }

    // before the request is made
    init!.headers = { ...init!.headers, ...headers }

    return fetch(input, init)
  }
}
