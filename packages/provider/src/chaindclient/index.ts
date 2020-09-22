// import { fetch as polyfetch } from 'whatwg-fetch' // TODO: do we even need this polyfill..?

export * from './chaind.gen'

import { ChaindService as BaseChaindService } from './chaind.gen'

export class ChaindService extends BaseChaindService {
  jwtAuth: string | undefined = undefined

  constructor(hostname: string) {
    super(hostname, window.fetch)
    this.fetch = this._fetch
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    return new Promise<Response>((resolve, reject) => {
      // automatically include jwt auth header to requests
      // if its been set on the api client
      const headers = {}
      if (this.jwtAuth && this.jwtAuth.length > 0) {
        headers['Authorization'] = `BEARER ${this.jwtAuth}`
      }

      // before the request is made
      init!.headers = { ...init!.headers, ...headers }
  
      window.fetch(input, init).then(resp => {
        // after the request has been made..
        resolve(resp)
      }).catch(err => {
        // request error
        reject(err)
      })
    })
  } 
}
