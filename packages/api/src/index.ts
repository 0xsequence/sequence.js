import {
  Precondition as ChainPrecondition,
  encodePrecondition as encodeChainPrecondition,
  isPrecondition as isChainPrecondition
} from '@0xsequence/relayer'
import { ethers } from 'ethers'

import * as proto from './api.gen'

export class SequenceAPIClient extends proto.API {
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

export * from './api.gen'

export type Precondition = { chainId: ethers.BigNumberish } & ChainPrecondition

export function isPrecondition(precondition: any): precondition is Precondition {
  return (
    typeof precondition === 'object' && precondition && isBigNumberish(precondition.chainId) && isChainPrecondition(precondition)
  )
}

export function encodePrecondition(precondition: Precondition): proto.Precondition {
  const { type, precondition: args } = encodeChainPrecondition(precondition)
  delete args.chainId
  return { type, chainID: encodeBigNumberish(precondition.chainId), precondition: args }
}

function isBigNumberish(value: any): value is ethers.BigNumberish {
  try {
    ethers.toBigInt(value)
    return true
  } catch {
    return false
  }
}

function encodeBigNumberish<T extends ethers.BigNumberish | undefined>(
  value: T
): T extends ethers.BigNumberish ? string : undefined {
  return value !== undefined ? ethers.toBigInt(value).toString() : (undefined as any)
}
