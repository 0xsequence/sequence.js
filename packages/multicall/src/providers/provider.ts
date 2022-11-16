import { ethers, BigNumber, utils } from 'ethers'
import { promisify, getRandomInt } from '@0xsequence/utils'
import { Multicall, MulticallOptions } from '../multicall'
import { JsonRpcMethod } from '../constants'
import { JsonRpcVersion, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export const ProxyMethods = [
  'getNetwork',
  'getBlockNumber',
  'getGasPrice',
  'getTransactionCount',
  'getStorageAt',
  'sendTransaction',
  'estimateGas',
  'getBlock',
  'getTransaction',
  'getTransactionReceipt',
  'getLogs',
  'emit',
  'litenerCount',
  'addListener',
  'removeListener',
  'waitForTransaction',
  'detectNetwork',
  'getBlockWithTransactions'
]

export class MulticallProvider extends ethers.providers.BaseProvider {
  private multicall: Multicall

  constructor(private provider: ethers.providers.Provider, multicall?: Multicall | Partial<MulticallOptions>) {
    super(provider.getNetwork())
    this.multicall = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall)

    ProxyMethods.forEach(m => {
      if ((provider as any)[m] !== undefined) {
        ;(this as any)[m] = (...args: any) => (provider as any)[m](...args)
      }
    })
  }

  listenerCount = this.provider.listenerCount

  getResolver = async (name: string | Promise<string>) => {
    const provider = this.provider as ethers.providers.BaseProvider

    if (provider.getResolver) {
      const ogResolver = await provider.getResolver(await name)
      if (!ogResolver) return null
      return new ethers.providers.Resolver(this as any, ogResolver.address, ogResolver.name)
    }

    return provider.getResolver(await name)
  }

  next = async (req: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    try {
      switch (req.method) {
        case JsonRpcMethod.ethCall:
          this.callback(req, callback, await this.provider.call(req.params![0], req.params![1]))
          break

        case JsonRpcMethod.ethGetCode:
          this.callback(req, callback, await this.provider.getCode(req.params![0], req.params![1]))
          break

        case JsonRpcMethod.ethGetBalance:
          this.callback(req, callback, await this.provider.getBalance(req.params![0], req.params![1]))
          break
      }
    } catch (e) {
      this.callback(req, callback, undefined, e)
    }
  }

  private callback(req: JsonRpcRequest, callback: JsonRpcResponseCallback, resp: any, err?: any) {
    callback(err, {
      jsonrpc: JsonRpcVersion,
      id: req.id!,
      result: resp,
      error: err
    })
  }

  async call(
    transaction: utils.Deferrable<ethers.providers.TransactionRequest>,
    blockTag?: string | number | Promise<ethers.providers.BlockTag>
  ): Promise<string> {
    return this.rpcCall(JsonRpcMethod.ethCall, transaction, blockTag)
  }

  async getCode(
    addressOrName: string | Promise<string>,
    blockTag?: string | number | Promise<ethers.providers.BlockTag>
  ): Promise<string> {
    return this.rpcCall(JsonRpcMethod.ethGetCode, addressOrName, blockTag)
  }

  async getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: string | number | Promise<ethers.providers.BlockTag>
  ): Promise<BigNumber> {
    return this.rpcCall(JsonRpcMethod.ethGetBalance, addressOrName, blockTag)
  }

  async rpcCall(method: string, ...params: any[]): Promise<any> {
    const reqId = getRandomInt()
    const resp = await promisify(this.multicall.handle)(this.next, {
      jsonrpc: JsonRpcVersion,
      id: reqId,
      method: method,
      params: params
    })
    return resp!.result
  }
}
