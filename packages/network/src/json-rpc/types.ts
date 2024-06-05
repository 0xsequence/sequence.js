export type JsonRpcRequest = {
  jsonrpc?: '2.0'
  id?: number
  method: string
  params?: any[]

  // ...
  chainId?: number
}

export type JsonRpcResponse = {
  jsonrpc?: string
  id: number
  result: any
  error?: JsonRpcErrorPayload
}

export type JsonRpcErrorPayload = {
  code: number
  message?: string
  data?: any
}

// EIP1193Provider with reponse of R (default any), but in most cases R will be of type JsonRpcResponse.
export interface EIP1193Provider<R = any> {
  request(request: { method: string; params?: any[]; chainId?: number }): Promise<R>
}

export type EIP1193ProviderFunc<R = any> = (request: { method: string; params?: any[]; chainId?: number }) => Promise<R>

export interface JsonRpcSender<R = any> {
  send(method: string, params?: any[], chainId?: number): Promise<R>
}

export type JsonRpcSendFunc<R = any> = (method: string, params?: any[], chainId?: number) => Promise<R>

export type JsonRpcResponseCallback = (error: JsonRpcErrorPayload | undefined, response?: JsonRpcResponse) => void

export type JsonRpcSendAsyncFunc = (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => void

export type JsonRpcMiddleware = (next: EIP1193ProviderFunc) => EIP1193ProviderFunc

export interface JsonRpcMiddlewareHandler {
  requestHandler: JsonRpcMiddleware
}
