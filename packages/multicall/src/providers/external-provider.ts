import { ExternalProvider } from '@ethersproject/providers'
import { Multicall, MulticallOptions } from '../multicall'
import { JsonRpcRequest, JsonRpcResponseCallback } from "@0xsequence/network"

export class MulticallExternalProvider implements ExternalProvider {
  private multicall: Multicall

  constructor(private provider: ExternalProvider, multicall?: Multicall | Partial<MulticallOptions>) {
    this.multicall = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall!)
  }

  next = async (req: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    const cb = this.provider.send ? this.provider.send : this.provider.sendAsync
    cb!(req, callback)
  }

  sendAsync = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    this.multicall.handle(this.next, request, callback)
  }

  send = this.sendAsync
}
