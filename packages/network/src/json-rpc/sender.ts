import { providers } from 'ethers'
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResponseCallback,
  JsonRpcHandler,
  JsonRpcFetchFunc,
  JsonRpcRequestFunc,
  JsonRpcVersion
} from './types'
import { isJsonRpcProvider, isJsonRpcHandler } from './utils'

type ExternalProvider = providers.ExternalProvider

let _nextId = 0

export class JsonRpcSender implements JsonRpcHandler {
  readonly send: JsonRpcFetchFunc
  readonly request: JsonRpcRequestFunc
  readonly defaultChainId?: number

  constructor(provider: providers.JsonRpcProvider | JsonRpcHandler | JsonRpcFetchFunc, defaultChainId?: number) {
    this.defaultChainId = defaultChainId

    if (isJsonRpcProvider(provider)) {
      // we can ignore defaultChainId for JsonRpcProviders as they are already chain-bound
      this.send = provider.send.bind(provider)
    } else if (isJsonRpcHandler(provider)) {
      this.send = (method: string, params?: Array<any>, chainId?: number): Promise<any> => {
        return new Promise((resolve, reject) => {
          provider.sendAsync(
            {
              // TODO: really shouldn't have to set these here?
              jsonrpc: JsonRpcVersion,
              id: ++_nextId,
              method,
              params
            },
            (error: any, response?: JsonRpcResponse) => {
              if (error) {
                reject(error)
              } else if (response) {
                resolve(response.result)
              } else {
                resolve(undefined)
              }
            },
            chainId || this.defaultChainId
          )
        })
      }
    } else {
      this.send = provider
    }

    this.request = (request: { method: string; params?: any[] }, chainId?: number): Promise<any> => {
      return this.send(request.method, request.params, chainId)
    }
  }

  sendAsync = (
    request: JsonRpcRequest,
    callback: JsonRpcResponseCallback | ((error: any, response: any) => void),
    chainId?: number
  ) => {
    this.send(request.method, request.params, chainId || this.defaultChainId)
      .then(r => {
        callback(undefined, {
          jsonrpc: '2.0',
          id: request.id,
          result: r
        })
      })
      .catch(e => {
        callback(e, undefined)
      })
  }
}

export class JsonRpcExternalProvider implements ExternalProvider, JsonRpcHandler {
  constructor(private provider: providers.JsonRpcProvider) {}

  sendAsync = (request: JsonRpcRequest, callback: JsonRpcResponseCallback | ((error: any, response: any) => void)) => {
    this.provider
      .send(request.method, request.params!)
      .then(r => {
        callback(undefined, {
          jsonrpc: '2.0',
          id: request.id,
          result: r
        })
      })
      .catch(e => {
        callback(e, undefined)
      })
  }

  send = this.sendAsync
}
