import { BigNumber, ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { JsonRpcMethod } from './constants'
import { BlockTag, eqBlockTag, parseBlockTag, partition, safeSolve } from './utils'
import { promisify, getRandomInt } from '@0xsequence/utils'
import { JsonRpcVersion, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcHandlerFunc, sequenceContext } from "@0xsequence/network"

export type MulticallOptions = {
  // number of calls to enqueue before calling.
  batchSize: number,

  // number of calls to batch within a time window (in milliseconds). If 0, will disable timeWindow.
  timeWindow: number,

  // contract is the address of the Sequence MultiCallUtils smart contract where
  // the batched multicall is sent to an Ethereum node.
  contract: string,

  // logs details about aggregated calls
  verbose: boolean
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
  contract: sequenceContext.sequenceUtils!,
  verbose: false
}

export class Multicall {
  public static DefaultOptions = { ... DefaultMulticallOptions }

  readonly batchableJsonRpcMethods = [
    JsonRpcMethod.ethCall,
    JsonRpcMethod.ethGetCode,
    JsonRpcMethod.ethGetBalance
  ]

  readonly multicallInterface = new ethers.utils.Interface(walletContracts.sequenceUtils.abi)

  public options: MulticallOptions

  constructor(options?: Partial<MulticallOptions>) {
    this.options = options ? { ...Multicall.DefaultOptions, ...options } : Multicall.DefaultOptions
    if (this.options.batchSize <= 0) throw new Error(`Invalid batch size of ${this.options.batchSize}`)
  }

  private timeout: NodeJS.Timeout | undefined
  private queue = [] as QueueEntry[]

  scheduleExecution = () => {
    if (this.queue.length > 0) {
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
      if (this.options.verbose) console.log('Scheduling call', request.method)
      this.scheduleExecution()
      return
    }

    if (this.options.verbose) console.log('Forwarded call', request.method)

    // Move to next handler
    return next(request, callback)
  }

  run = async () => {
    /* eslint-disable no-var */
    if (this.options.verbose) console.log('Processing multicall')

    // Read items from queue
    const limit = Math.min(this.options.batchSize, this.queue.length)
    if (limit === 0) return

    // Skip multicall on single item
    if (limit === 1) {
      this.forward(this.queue[0])
      this.queue = []
      if (this.options.verbose) console.log('Skip multicall, single item')
      return
    }

    if (this.options.verbose) console.log('Resolving', limit)

    // Get batch from queue
    var items = this.queue.slice(0, limit)

    // Update queue
    this.queue = limit === this.queue.length ? [] : this.queue.slice(limit)
    if (this.options.verbose) console.log('Updated queue', this.queue.length)

    if (this.queue.length !== 0) {
      this.scheduleExecution()
    }

    // Get next candidate
    const next = items[0].next as JsonRpcHandlerFunc
    let blockTag: BlockTag | undefined

    // Partition incompatible calls
    var [items, discartItems] = partition(items, (item) => {
      try {
        // Mixed next callbacks
        if (item.next !== next) return false

        switch (item.request.method) {
          case JsonRpcMethod.ethCall:
            // Unsupported eth_call parameters
            if (
              item.request.params![0].from ||
              item.request.params![0].gasPrice ||
              item.request.params![0].value
            ) {
              return false  
            }
          case JsonRpcMethod.ethGetBalance:
          case JsonRpcMethod.ethGetCode:
            // Mixed blockTags
            const itemBlockTag = parseBlockTag(item.request.params![1])
            if (blockTag === undefined) blockTag = itemBlockTag
            if (!eqBlockTag(itemBlockTag, blockTag)) return false
        }

        return true
      } catch {
        return false
      }
    })

    // Forward discarted items
    // end execution if no items remain
    if (discartItems.length !== 0) {
      if (this.options.verbose) console.log('Forwarding incompatible calls', discartItems.length)
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
              target: v.request.params![0].to,
              data: v.request.params![0].data,
              gasLimit: v.request.params![0].gas ? v.request.params![0].gas : 0,
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
                this.multicallInterface.getFunction('callCode'), [v.request.params![0]]
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
                this.multicallInterface.getFunction('callBalanceOf'), [v.request.params![0]]
              )
            }
          default:
            return null
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
      if (this.options.verbose) console.log('Forwarding calls on error', discartItems.length)
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

    // TODO: fix types below..

    const res = await safeSolve(
      // @ts-ignore
      promisify<JsonRpcRequest, JsonRpcResponse>(next)({
        id: reqId!,
        jsonrpc: JsonRpcVersion!,
        method: JsonRpcMethod.ethCall!,
        params: [{
          to: this.options.contract!,
          value: 0,
          data: encodedCall!
        }, BigNumber.isBigNumber(blockTag) ? blockTag.toNumber() : blockTag]
      // @ts-ignore
      }), (e) => ({
        jsonrpc: JsonRpcVersion!,
        id: reqId!,
        result: undefined,
        error: e!
      })
    )
    
    // Error calling multicall
    // Forward all calls to middleware
    // @ts-ignore
    if (res.error) {
      return this.forward(items)
    }

    // Decode result from multicall
    let decoded: ethers.utils.Result
    try {
      // @ts-ignore
      decoded = this.multicallInterface.decodeFunctionResult(this.multicallInterface.getFunction('multiCall'), res.result)
    } catch {
      this.forward(items)
      return
    }

    // Send results for each request
    // errors fallback through the middleware
    if (this.options.verbose) console.log('Got response for', items.length)
    items.forEach((item, index) => {
      if (!decoded[0][index]) {
        this.forward(item)
      } else {
        switch (item.request.method) {
          case JsonRpcMethod.ethCall:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc!,
              id: item.request.id!,
              result: decoded[1][index]
            })
            break
          case JsonRpcMethod.ethGetCode:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc!,
              id: item.request.id!,
              result: ethers.utils.defaultAbiCoder.decode(['bytes'], decoded[1][index])[0]
            })
            break
          case JsonRpcMethod.ethGetBalance:
            item.callback(undefined, {
              jsonrpc: item.request.jsonrpc!,
              id: item.request.id!,
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
