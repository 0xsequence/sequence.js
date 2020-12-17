import { Multicall, MulticallOptions } from "../multicall"
import { JsonRpcRequest, JsonRpcResponseCallback, JsonRpcHandlerFunc, JsonRpcMiddleware } from "@0xsequence/network"

export const multicallMiddleware = (multicall?: Multicall | MulticallOptions): JsonRpcMiddleware => (next: JsonRpcHandlerFunc) => {
  const lib = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall)
  return (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    return lib.handle(next, request, callback)
  }
}
