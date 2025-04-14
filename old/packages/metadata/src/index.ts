export * from './metadata.gen'

import { Metadata as MetadataRpc, Collections as CollectionsRpc } from './metadata.gen'

export class SequenceMetadata extends MetadataRpc {
  constructor(
    hostname: string = 'https://metadata.sequence.app',
    public projectAccessKey?: string,
    public jwtAuth?: string
  ) {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
    this.fetch = this._fetch
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    // automatically include jwt and access key auth header to requests
    // if its been set on the client
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

export class SequenceCollections extends CollectionsRpc {
  constructor(
    hostname: string = 'https://metadata.sequence.app',
    public jwtAuth?: string
  ) {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
    this.fetch = this._fetch
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    // automatically include jwt auth header to requests
    // if its been set on the client
    const headers: { [key: string]: any } = {}

    const jwtAuth = this.jwtAuth

    if (jwtAuth && jwtAuth.length > 0) {
      headers['Authorization'] = `BEARER ${jwtAuth}`
    }

    // before the request is made
    init!.headers = { ...init!.headers, ...headers }

    return fetch(input, init)
  }

  // TODO: add uploadAsset() method similar to,
  // https://github.com/0xsequence/go-sequence/blob/master/metadata/collections.go#L52
}
