import { JsonRpcRequest, JsonRpcResponseCallback, Multicall, MulticallConf } from "../multicall"


export type JsonRpcHandler = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => void
export type JsonRpcMiddleware = (next: JsonRpcHandler) => JsonRpcHandler

export const multicallMiddleware = (multicall?: Multicall | MulticallConf): JsonRpcMiddleware => (next: JsonRpcHandler) => {
  const lib = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall)
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    return lib.handle(next, request, callback)
  }
}
