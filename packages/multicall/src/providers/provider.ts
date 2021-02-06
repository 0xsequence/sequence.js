import { ethers , BigNumber } from 'ethers'
import { BlockTag, BlockWithTransactions } from '@ethersproject/abstract-provider'
import { Deferrable } from '@ethersproject/properties'
import { promisify, getRandomInt } from '@0xsequence/utils'
import { Multicall, MulticallOptions } from '../multicall'
import { JsonRpcMethod } from '../constants'
import { JsonRpcVersion, JsonRpcRequest, JsonRpcResponseCallback } from "@0xsequence/network"

export class MulticallProvider extends ethers.providers.BaseProvider {
  private multicall: Multicall

  constructor(private provider: ethers.providers.Provider, multicall?: Multicall | Partial<MulticallOptions>) {
    super(provider.getNetwork())
    this.multicall = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall)
  }

  listenerCount = this.provider.listenerCount

  getBlockWithTransactions = (blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>): Promise<BlockWithTransactions> => {
    throw new Error('unsupported')
  }

  getNetwork = this.provider.getNetwork
  getBlockNumber = this.provider.getBlockNumber
  getGasPrice = this.provider.getGasPrice
  getTransactionCount = this.provider.getTransactionCount
  getStorageAt = this.provider.getStorageAt
  sendTransaction = this.provider.sendTransaction
  estimateGas = this.provider.estimateGas
  getBlock = this.provider.getBlock
  getTransaction = this.provider.getTransaction
  getTransactionReceipt = this.provider.getTransactionReceipt
  getLogs = this.provider.getLogs
  emit = this.provider.emit
  litenerCount = this.provider.listenerCount
  listeners = this.provider.listeners
  addListener = this.provider.addListener
  removeListener = this.provider.removeListener
  waitForTransaction = this.provider.waitForTransaction

  getResolver = async (name: string | Promise<string>) => {
    const provider = this.provider as ethers.providers.BaseProvider

    if (provider.getResolver) {
      const ogResolver = await provider.getResolver(await name)
      return new ethers.providers.Resolver(this as any, ogResolver.address, ogResolver.name)
    }

    return undefined
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
    callback(undefined, {
      jsonrpc: JsonRpcVersion,
      id: req.id!,
      result: resp,
      error: err
    })
  }

  async call(transaction: Deferrable<ethers.providers.TransactionRequest>, blockTag?: string | number | Promise<ethers.providers.BlockTag>): Promise<string> {
    return this.rpcCall(JsonRpcMethod.ethCall, transaction, blockTag)
  }

  async getCode(addressOrName: string | Promise<string>, blockTag?: string | number | Promise<ethers.providers.BlockTag>): Promise<string> {
    return this.rpcCall(JsonRpcMethod.ethGetCode, addressOrName, blockTag)
  }

  async getBalance(addressOrName: string | Promise<string>, blockTag?: string | number | Promise<ethers.providers.BlockTag>): Promise<BigNumber> {
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
