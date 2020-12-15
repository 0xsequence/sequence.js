import { providers } from 'ethers'
import { Multicall, MulticallConf, JsonRpcRequest, JsonRpcResponseCallback } from '../multicall'

export class MulticallExternalProvider implements providers.ExternalProvider {
  private multicall: Multicall

  constructor(private provider: providers.ExternalProvider, multicall?: Multicall | MulticallConf) {
    this.multicall = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall)
  }

  next = async (req: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    const cb = this.provider.send ? this.provider.send : this.provider.sendAsync
    cb(req, callback)
  }

  sendAsync = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    this.multicall.handle(this.next, request, callback)
  }

  send = this.sendAsync
}
