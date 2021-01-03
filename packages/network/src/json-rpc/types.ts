export const JsonRpcVersion = '2.0'

export interface JsonRpcRequest {
  jsonrpc?: string
  id?: number
  method: string
  params?: any[]
}

export interface JsonRpcResponse {
  jsonrpc: string
  id: number
  result: any
  error?: any
}

export type JsonRpcResponseCallback = (error: any, response?: JsonRpcResponse) => void

export type JsonRpcHandlerFunc = (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => void

export interface JsonRpcHandler {
  sendAsync: JsonRpcHandlerFunc
}

export type JsonRpcFetchFunc = (method: string, params?: any[], chainId?: number) => Promise<any>

export type JsonRpcMiddleware = (next: JsonRpcHandlerFunc) => JsonRpcHandlerFunc

export interface JsonRpcMiddlewareHandler {
  sendAsyncMiddleware: JsonRpcMiddleware
}
