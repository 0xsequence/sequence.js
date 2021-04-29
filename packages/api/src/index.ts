export * from './api.gen'

import fetch from 'cross-fetch'

import { ArcadeumAPI as BaseArcadeumAPI } from './api.gen'

export type RefreshJWTCallback = () => Promise<string>

export class ArcadeumAPIClient extends BaseArcadeumAPI {
  constructor(
    hostname: string,
    private jwtAuth?: string,
    private refreshJWT?: RefreshJWTCallback
  ) {
    super(hostname, fetch)
    this.fetch = this._fetch
  }

  _fetch = async (input: RequestInfo, init?: RequestInit, retry: boolean = true): Promise<Response> => {
    // automatically include jwt auth header to requests
    // if its been set on the api client
    const headers: { [key: string]: any } = {}
    if (this.jwtAuth && this.jwtAuth.length > 0) {
      headers['Authorization'] = `BEARER ${this.jwtAuth}`
    }

    // before the request is made
    init!.headers = { ...init!.headers, ...headers }

    // we should avoid retrying if the request is to /GetAuthToken itself
    let url: string
    switch (typeof input) {
      case 'string':
        url = input
        break
      case 'object':
        url = input.url
        break
    }
    let isGetAuthToken: boolean
    try {
      isGetAuthToken = new URL(url).pathname.endsWith('/GetAuthToken')
    } catch {
      isGetAuthToken = url.includes('/GetAuthToken')
    }

    try {
      const resp = await fetch(input, init)

      if (resp.status >= 400 && resp.status < 600) {
        if (retry && this.refreshJWT && !isGetAuthToken) {
          // refresh token...
          this.jwtAuth = await this.refreshJWT()

          // ...and try again
          return this._fetch(input, init, false)
        }
      }

      return resp
    } catch (err) {
      if (retry && this.refreshJWT && !isGetAuthToken) {
        // refresh token...
        this.jwtAuth = await this.refreshJWT()

        // ...and try again
        return this._fetch(input, init, false)
      }

      throw err
    }
  }
}
