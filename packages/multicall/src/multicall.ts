
import { ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { JsonRpcMethod } from './constants'
import { BlockTag, eqBlockTag, getRandomInt, parseBlockTag, partition, safeSolve } from './utils'
import { promisify } from 'util'
import { JsonRpcVersion, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcMiddleware, JsonRpcHandlerFunc } from "@0xsequence/network"


export type MulticallOptions = {
  // number of calls to enqueue before calling.
  batchSize: number,

  // number of calls to batch within a time window (in milliseconds). If 0, will disable timeWindow.
  timeWindow: number,

  // contract is the address of the Sequence MultiCallUtils smart contract where
  // the batched multicall is sent to an Ethereum node.
  contract: string
}

type QueueEntry = {
  request: JsonRpcRequest,
  callback: JsonRpcResponseCallback,
  next: JsonRpcHandlerFunc,
  error?: boolean,
  result?: JsonRpcResponseCallback
}

const DefaultMulticallOptions = {
  batchSize: 50,
  timeWindow: 50,
  contract: ''
}

export class Multicall {
  public static DefaultOptions = { ... DefaultMulticallOptions }

  readonly batchableJsonRpcMethods = [
    JsonRpcMethod.ethCall,
    JsonRpcMethod.ethGetCode,
    JsonRpcMethod.ethGetBalance
  ]

  readonly multicallInterface = new ethers.utils.Interface(walletContracts.requireUtils.abi)

  public options: MulticallOptions

  constructor(options: Partial<MulticallOptions>) {
    this.options = { ...Multicall.DefaultOptions, ...options }
    if (this.options.batchSize <= 0) throw new Error(`Invalid batch size of ${this.options.batchSize}`)
  }

  private timeout: NodeJS.Timeout | undefined
  private queue = [] as QueueEntry[]

  scheduleExecution = () => {
    if (this.queue.length < this.options.batchSize) {
      if (this.timeout) clearTimeout(this.timeout)
      this.timeout = setTimeout(this.run, this.options.timeWindow)
    }
  }

  handle = (next: JsonRpcHandlerFunc, request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    // Schedule for batching and return
    if (this.batchableJsonRpcMethods.find((m) => m === request.method)) {
      this.queue.push({
        request: request,
        callback: callback,
        next: next
      })
      this.scheduleExecution()
      return
    }

    // Move to next handler
    return next(request, callback)
  }

  run = async () => {
    /* eslint-disable no-var */

    // Read items from queue
    const limit = Math.min(this.options.batchSize, this.queue.length)
    if (limit === 0) return

    // Skip multicall on single item
    if (limit === 1) {
      this.forward(this.queue[0])
      this.queue = []
      return
    }

    // Get batch from queue
    var items = this.queue.slice(0, limit)

    // Update queue
    this.queue = limit === this.queue.length ? [] : this.queue.slice(limit)

    if (this.queue.length !== 0) {
      this.scheduleExecution()
    }

    // Get next candidate
    const next = items[0].next as JsonRpcHandlerFunc
    let blockTag: BlockTag = null

    // Partition incompatible calls
    var [items, discartItems] = partition(items, (item) => {
      try {
        // Mixed next callbacks
        if (item.next !== next) return false

        switch (item.request.method) {
          case JsonRpcMethod.ethCall:
            // Unsupported eth_call parameters
            if (
              item.request.params[0].from ||
              item.request.params[0].gasPrice ||
              item.request.params[0].value
            ) {
              return false  
            }
          case JsonRpcMethod.ethGetBalance:
          case JsonRpcMethod.ethGetCode:
            // Mixed blockTags
            const itemBlockTag = parseBlockTag(item.request.params[1])
            if (blockTag === null) blockTag = itemBlockTag
            if (!eqBlockTag(itemBlockTag, blockTag)) return false
        }

        return true
      } catch {}
    })

    // Forward discarted items
    // end execution if no items remain
    if (discartItems.length !== 0) {
      this.forward(discartItems)
      if (items.length === 0) return
    }

    // Aggregate all calls
    let callParams = items.map((v) => {
      try {
        switch (v.request.method) {
          case JsonRpcMethod.ethCall:
            return {
              delegateCall: false,
              revertOnError: false,
              target: v.request.params[0].to,
              data: v.request.params[0].data,
              gasLimit: v.request.params[0].gas ? v.request.params[0].gas : 0,
              value: 0
            }
          case JsonRpcMethod.ethGetCode:
            return {
              delegateCall: false,
              revertOnError: false,
              target: this.options.contract,
              gasLimit: 0,
              value: 0,
              data: this.multicallInterface.encodeFunctionData(
                this.multicallInterface.getFunction('callCode'), [v.request.params[0]]
              )
            }
          case JsonRpcMethod.ethGetBalance:
            return {
              delegateCall: false,
              revertOnError: false,
              target: this.options.contract,
              gasLimit: 0,
              value: 0,
              data: this.multicallInterface.encodeFunctionData(
                this.multicallInterface.getFunction('callBalanceOf'), [v.request.params[0]]
              )
            }
          }
        } catch {
          return null
        }
      }
    )

    // Filter calls with enconding errors and forward items
    var [items, discartItems] = partition(items, (_, i: number) => callParams[i] !== undefined)
    callParams = callParams.filter((c) => c)

    if (discartItems.length !== 0) {
      this.forward(discartItems)
      if (items.length === 0) return
    }

    // Encode multicall
    let encodedCall: string
    try {
      encodedCall = this.multicallInterface.encodeFunctionData(
        this.multicallInterface.getFunction('multiCall'), [callParams]
      )
    } catch {
      this.forward(items)
      return
    }

    // Forward single multicall rpc call
    const reqId = getRandomInt()

    const res = await safeSolve(
      promisify(next)({
        id: reqId,
        jsonrpc: JsonRpcVersion,
        method: JsonRpcMethod.ethCall,
        params: [{
          to: this.options.contract,
          value: 0,
          data: encodedCall
        }, blockTag]
      }), (e) => ({
        jsonrpc: JsonRpcVersion,
        id: reqId,
        result: undefined,
        error: e
      })
    )
    
    // Error calling multicall
    // Forward all calls to middleware
    if (res.error) {
      return this.forward(items)
    }

    // Decode result from multicall
    let decoded: ethers.utils.Result
    try {
      decoded = this.multicallInterface.decodeFunctionResult(
        this.multicallInterface.getFunction('multiCall'), res.result
      )
    } catch {
      this.forward(items)
      return
    }

    // Send results for each request
    // errors fallback through the middleware
    items.forEach((item, index) => {
      if (!decoded[0][index]) {
        this.forward(item)
      } else {
        switch (item.request.method) {
          case JsonRpcMethod.ethCall:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc,
              id: item.request.id,
              result: decoded[1][index]
            })
            break
          case JsonRpcMethod.ethGetCode:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc,
              id: item.request.id,
              result: ethers.utils.defaultAbiCoder.decode(['bytes'], decoded[1][index])[0]
            })
            break
          case JsonRpcMethod.ethGetBalance:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc,
              id: item.request.id,
              result: ethers.utils.defaultAbiCoder.decode(['uint256'], decoded[1][index])[0]
            })
            break
        }
      }
    })
  }

  private forward(entries: QueueEntry[] | QueueEntry) {
    if (Array.isArray(entries)) {
      entries.forEach((e) => e.next(e.request, e.callback))
    } else {
      entries.next(entries.request, entries.callback)
    }
  }

  static isMulticall(cand: any): cand is Multicall {
    return (
      cand &&
      cand.handle !== undefined &&
      cand.conf !== undefined &&
      Multicall.isMulticallOptions(cand.options)
    )
  }

  static isMulticallOptions(cand: any): cand is MulticallOptions {
    return (
      cand !== undefined &&
      cand.batchSize !== undefined &&
      cand.timeWindow !== undefined &&
      cand.contract !== undefined
    )
  }
}
