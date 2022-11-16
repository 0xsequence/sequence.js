import { providers } from 'ethers'
import { Multicall, MulticallOptions } from '../multicall'
import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

type ExternalProvider = providers.ExternalProvider

export class MulticallExternalProvider implements ExternalProvider {
  private multicall: Multicall

  constructor(private provider: providers.ExternalProvider, multicall?: Multicall | Partial<MulticallOptions>) {
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

  public get isMetaMask() {
    return this.provider.isMetaMask
  }

  public get isStatus() {
    return this.provider.isStatus
  }
}
