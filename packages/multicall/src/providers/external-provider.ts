import { Eip1193Provider } from 'ethers'
import { Multicall, MulticallOptions } from '../multicall'
import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export class MulticallExternalProvider implements Eip1193Provider {
  private multicall: Multicall

  constructor(
    private provider: Eip1193Provider,
    multicall?: Multicall | Partial<MulticallOptions>
  ) {
    this.multicall = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall!)

    if (provider.send) {
      const next = async (req: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
        provider.send!(req, callback)
      }

      ;(this as any).send = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
        this.multicall.handle(next, request, callback)
      }
    }

    if (provider.sendAsync) {
      const next = async (req: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
        provider.sendAsync!(req, callback)
      }

      ;(this as any).sendAsync = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
        this.multicall.handle(next, request, callback)
      }
    }
  }

  async request(request: { method: string; params?: Array<any> | Record<string, any> }): Promise<any> {
    return this.provider.request(request)
  }
}
