export * from './indexer.gen'
export * as IndexerGateway from './indexergw.gen'

import { Indexer as IndexerRpc } from './indexer.gen'
import { IndexerGateway as IndexerGatewayRpc } from './indexergw.gen'

export interface SequenceIndexerOpts {
  JWTAuth?: string
  ProjectAccessKey?: string
}

export class SequenceIndexer extends IndexerRpc {
  public jwtAuth?: string
  public projectAccessKey?: string

  constructor(
    hostname: string,
    opts: SequenceIndexerOpts
  );
  constructor(
    hostname: string,
    projectAccessKey?: string,
    jwtAuth?: string
  );
  constructor(
    hostname: string,
    ...args: any[]
  ) {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)

    if (args.length === 1 && typeof args[0] === 'object') {
      const opts = args[0] as SequenceIndexerOpts
      this.projectAccessKey = opts.ProjectAccessKey
      this.jwtAuth = opts.JWTAuth
    } else {
      const [projectAccessKey, jwtAuth] = args
      this.projectAccessKey = projectAccessKey || undefined
      this.jwtAuth = jwtAuth || undefined
    }

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

export class SequenceIndexerGateway extends IndexerGatewayRpc {
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
