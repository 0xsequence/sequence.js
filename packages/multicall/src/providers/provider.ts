import { ethers, providers } from 'ethers'
import { Deferrable } from 'ethers/lib/utils'
import { getRandomInt, promisify } from '../utils'
import { Multicall, MulticallConf, JsonRpcRequest, JsonRpcResponseCallback } from '../multicall'
import { rpcMethods, rpcVersion } from '../constants'


export class MulticallProvider implements ethers.providers.Provider {
  private multicall: Multicall

  constructor(private provider: ethers.providers.Provider, multicall?: Multicall | MulticallConf) {
    this.multicall = Multicall.isMulticall(multicall) ? multicall : new Multicall(multicall)
  }

  _isProvider = true

  listenerCount = this.provider.listenerCount

  getBlockWithTransactions = undefined

  getNetwork = this.provider.getNetwork
  getBlockNumber = this.provider.getBlockNumber
  getGasPrice = this.provider.getGasPrice
  getBalance = this.provider.getBalance
  getTransactionCount = this.provider.getTransactionCount
  getStorageAt = this.provider.getStorageAt
  sendTransaction = this.provider.sendTransaction
  estimateGas = this.provider.estimateGas
  getBlock = this.provider.getBlock
  getTransaction = this.provider.getTransaction
  getTransactionReceipt = this.provider.getTransactionReceipt
  getLogs = this.provider.getLogs
  resolveName = this.provider.resolveName
  lookupAddress = this.provider.lookupAddress
  on = this.provider.on
  once = this.provider.once
  emit = this.provider.emit
  litenerCount = this.provider.listenerCount
  listeners = this.provider.listeners
  off = this.provider.off
  removeAllListeners = this.provider.removeAllListeners
  addListener = this.provider.addListener
  removeListener = this.provider.removeListener
  waitForTransaction = this.provider.waitForTransaction

  next = async (req: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    switch (req.method) {
      case rpcMethods.ethCall:
        this.callback(req, callback, await this.provider.call(req.params[0], req.params[1]))
        break

      case rpcMethods.ethGetCode:
        this.callback(req, callback, await this.provider.getCode(req.params[0], req.params[1]))
        break
    }
  }

  private callback(req: JsonRpcRequest, callback: JsonRpcResponseCallback, resp: any) {
    callback(undefined, {
      jsonrpc: rpcVersion,
      id: req.id,
      result: resp,
      error: undefined
    })
  }

  async call(transaction: Deferrable<ethers.providers.TransactionRequest>, blockTag?: string | number | Promise<ethers.providers.BlockTag>): Promise<string> {
    return this.rpcCall(rpcMethods.ethCall, transaction, blockTag)
  }

  async getCode(addressOrName: string | Promise<string>, blockTag?: string | number | Promise<ethers.providers.BlockTag>): Promise<string> {
    return this.rpcCall(rpcMethods.ethGetCode, addressOrName, blockTag)
  }

  async rpcCall(method: string, ...params: any[]): Promise<any> {
    const reqId = getRandomInt()
    const resp = await promisify(this.multicall.handle)(this.next, {
      jsonrpc: rpcVersion,
      id: reqId,
      method: method,
      params: params
    })
    return resp.result
  }
}
