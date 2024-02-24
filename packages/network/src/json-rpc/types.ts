export type JsonRpcRequest = {
  jsonrpc: '2.0'
  id?: number
  method: string
  params?: Array<any> | Record<string, any>

  // ...
  chainId?: number
}

// export type JsonRpcRequestParams = Array<any> | Record<string, any>

export type JsonRpcResponse = {
  id: number
  result: any
  error?: JsonRpcErrorPayload
}

export type JsonRpcErrorPayload = {
  code: number
  message?: string
  data?: any
}

// export type JsonRpcResponseCallback = (error?: ProviderRpcError, response?: JsonRpcResponse) => void

// export type JsonRpcHandlerFunc = (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => void

// export interface JsonRpcHandler {
//   sendAsync: JsonRpcHandlerFunc
// }

export interface EIP1193Provider<R = any> {
  request(request: { id?: number, method: string, params?: Array<any> | Record<string, any>, chainId?: number }): Promise<R>;
}

export type EIP1193ProviderFunc<R = any> = (request: { id?: number, method: string; params?: Array<any> | Record<string, any> }, chainId?: number) => Promise<R>

export type JsonRpcRequestFunc = (method: string, params?:  Array<any> | Record<string, any>, chainId?: number) => Promise<any>

export type JsonRpcMiddleware = (next: EIP1193ProviderFunc) => EIP1193ProviderFunc

export interface JsonRpcMiddlewareHandler {
  requestMiddleware: JsonRpcMiddleware
}

// export interface ProviderRpcError extends Error {
//   code: number
//   message?: string
//   data?: any
// }
