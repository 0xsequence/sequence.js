
import { ethers } from 'ethers'
import { abi } from './abi/multicall'
import { rpcMethods, rpcVersion } from './constants'
import { BlockTag, eqBlockTag, getRandomInt, parseBlockTag, partition, promisify, safe, safeSolve } from './utils'

interface JsonRpcResponse {
  jsonrpc: string
  id: number
  result: any
  error?: any
}

export type JsonRpcResponseCallback = (error: any, response?: JsonRpcResponse) => void

type JsonRpcHandler = (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => void

export interface JsonRpcRequest {
  jsonrpc?: string
  id?: number
  method: string
  params?: any[]
}

type JsonRpcMiddleware = (next: JsonRpcHandler) => JsonRpcHandler

export interface AsyncSendableMiddleware {
  sendAsyncMiddleware: JsonRpcMiddleware
}

export type MulticallConf = {
  batchSize: number,
  timeWindow: number,
  contract: string
}

type QueueEntry = {
  request: JsonRpcRequest,
  callback: JsonRpcResponseCallback,
  next: JsonRpcHandler,
  error?: boolean,
  result?: JsonRpcResponseCallback
}

export class Multicall {
  public static DEFAULT_CONF = {
    batchSize: 50,
    timeWindow: 10,
    contract: ""
  }

  readonly aggregateJsonRpcMethods = [
    rpcMethods.ethCall,
    rpcMethods.ethGetCode
  ]

  readonly multicallInterface = new ethers.utils.Interface(abi)

  constructor(public conf: MulticallConf = Multicall.DEFAULT_CONF) {
    if (conf.batchSize <= 0) throw new Error(`Invalid batch size of ${conf.batchSize}`)
  }

  private timeout: NodeJS.Timeout | undefined
  private queue = [] as QueueEntry[]

  scheduleExecution = () => {
    if (this.queue.length < 100) {
      if (this.timeout) clearTimeout(this.timeout)
      this.timeout = setTimeout(this.run, this.conf.timeWindow)
    }
  }

  handle = (next: JsonRpcHandler, request: JsonRpcRequest, callback: JsonRpcResponseCallback) => {
    // Schedule for aggregation and return
    if (this.aggregateJsonRpcMethods.includes(request.method)) {
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
    // Read items from queue
    const limit = Math.min(this.conf.batchSize, this.queue.length)
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
    const next = items[0].next as JsonRpcHandler
    var blockTag: BlockTag = null

    // Partition incompatible calls
    var [items, discartItems] = partition(items, (item) => {
      try {
        // Mixed next callbacks
        if (item.next !== next) return false

        switch (item.request.method) {
          case rpcMethods.ethCall:
            // Unsupported eth_call parameters
            if (
              item.request.params[0].from ||
              item.request.params[0].gasPrice ||
              item.request.params[0].value
            ) {
              return false  
            }
          case rpcMethods.ethGetBalance:
          case rpcMethods.ethGetCode:
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
          case rpcMethods.ethCall:
            return {
              delegateCall: false,
              revertOnError: false,
              target: v.request.params[0].to,
              data: v.request.params[0].data,
              gasLimit: v.request.params[0].gas ? v.request.params[0].gas : 0,
              value: 0
            }
          case rpcMethods.ethGetCode:
            return {
              delegateCall: false,
              revertOnError: false,
              target: this.conf.contract,
              gasLimit: 0,
              value: 0,
              data: this.multicallInterface.encodeFunctionData(
                this.multicallInterface.getFunction('callCode'), [v.request.params[0]]
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
        jsonrpc: rpcVersion,
        method: rpcMethods.ethCall,
        params: [{
          to: this.conf.contract,
          value: 0,
          data: encodedCall
        }, blockTag]
      }), () => ({
        jsonrpc: rpcVersion,
        id: reqId,
        result: undefined,
        error: "0x"
      })
    )
    
    // Error calling multicall
    // Forward all calls to middleware
    if (res.error) {
      return this.forward(items)
    }

    // Decode result from multicall
    const decoded = this.multicallInterface.decodeFunctionResult(
      this.multicallInterface.getFunction('multiCall'), res.result
    )

    // Send results for each request
    // errors fallback through the middleware
    items.forEach((item, index) => {
      if (!decoded[0][index]) {
        this.forward(item)
      } else {
        switch (item.request.method) {
          case rpcMethods.ethCall:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc,
              id: item.request.id,
              result: decoded[1][index]
            })
            break
          case rpcMethods.ethGetCode:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc,
              id: item.request.id,
              result: ethers.utils.defaultAbiCoder.decode(['bytes'], decoded[1][index])[0]
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
      Multicall.isMulticallConf(cand.conf)
    )
  }

  static isMulticallConf(cand: any): cand is MulticallConf {
    return (
      cand.batchSize !== undefined &&
      cand.timeWindow !== undefined &&
      cand.contract !== undefined
    )
  }
}
