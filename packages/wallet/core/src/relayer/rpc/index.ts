import {
  Relayer as GenRelayer,
  SendMetaTxnReturn as RpcSendMetaTxnReturn,
  MetaTxn as RpcMetaTxn,
  FeeTokenType,
} from './relayer.gen'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../relayer'
import { Address, Hex, Bytes } from 'ox'
import { Payload, Precondition as PrimitivePrecondition } from '@0xsequence/wallet-primitives'
import {
  IntentPrecondition as RpcIntentPrecondition,
  ETHTxnStatus,
  FeeOption as RpcFeeOption,
  FeeToken as RpcFeeToken,
} from './relayer.gen'

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>

export class RpcRelayer implements Relayer {
  public readonly id: string
  private client: GenRelayer
  private fetch: Fetch

  constructor(hostname: string, fetchImpl?: Fetch) {
    this.id = `rpc:${hostname}`
    const effectiveFetch = fetchImpl || (typeof window !== 'undefined' ? window.fetch.bind(window) : undefined)
    if (!effectiveFetch) {
      throw new Error('Fetch implementation is required but not available in this environment.')
    }
    this.fetch = effectiveFetch
    this.client = new GenRelayer(hostname, this.fetch)
  }

  async feeOptions(
    wallet: Address.Address,
    chainId: bigint,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    const callsStruct: Payload.Calls = { type: 'call', space: 0n, nonce: 0n, calls: calls }
    const data = Payload.encode(callsStruct)

    try {
      const result = await this.client.feeOptions({
        wallet: wallet,
        to: wallet,
        data: Bytes.toHex(data),
      })

      const options = result.options.map(this.mapRpcFeeOptionToFeeOption)
      const quote = result.quote ? ({ _tag: 'FeeQuote', _quote: result.quote } as FeeQuote) : undefined

      return { options, quote }
    } catch (e) {
      console.warn('RpcRelayer.feeOptions failed:', e)
      return { options: [] }
    }
  }

  async relay(
    to: Address.Address,
    data: Hex.Hex,
    chainId: bigint,
    quote?: FeeQuote,
    preconditions?: PrimitivePrecondition.Precondition[],
  ): Promise<{ opHash: Hex.Hex }> {
    const rpcPreconditions = preconditions?.map((p) => this.mapPrimitivePreconditionToRpc(p, chainId))

    const rpcCall: RpcMetaTxn = {
      walletAddress: to,
      contract: to,
      input: data,
    }

    const result: RpcSendMetaTxnReturn = await this.client.sendMetaTxn({
      call: rpcCall,
      quote: quote ? JSON.stringify(quote._quote) : undefined,
      preconditions: rpcPreconditions,
    })

    if (!result.status) {
      console.error('RpcRelayer.relay failed', result)
      throw new Error(`Relay failed: TxnHash ${result.txnHash}`)
    }

    return { opHash: Hex.fromString(result.txnHash) }
  }

  async status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus> {
    try {
      const result = await this.client.getMetaTxnReceipt({ metaTxID: Hex.toString(opHash) })
      const receipt = result.receipt

      switch (receipt.status as ETHTxnStatus) {
        case ETHTxnStatus.QUEUED:
        case ETHTxnStatus.PENDING_PRECONDITION:
        case ETHTxnStatus.SENT:
          return { status: 'pending' }
        case ETHTxnStatus.SUCCEEDED:
          return { status: 'confirmed', transactionHash: Hex.fromString(receipt.txnReceipt) }
        case ETHTxnStatus.FAILED:
        case ETHTxnStatus.PARTIALLY_FAILED:
          return { status: 'failed', reason: receipt.revertReason || 'Relayer reported failure' }
        case ETHTxnStatus.DROPPED:
          return { status: 'failed', reason: 'Transaction dropped' }
        case ETHTxnStatus.UNKNOWN:
        default:
          return { status: 'unknown' }
      }
    } catch (error) {
      console.error(`RpcRelayer.status failed for opHash ${opHash}:`, error)
      return { status: 'failed', reason: 'Failed to fetch status' }
    }
  }

  async checkPrecondition(precondition: PrimitivePrecondition.Precondition): Promise<boolean> {
    console.warn('RpcRelayer.checkPrecondition is not implemented and returns true by default.')
    return true
  }

  private mapRpcFeeOptionToFeeOption(rpcOption: RpcFeeOption): FeeOption {
    return {
      token: this.mapRpcFeeTokenToAddress(rpcOption.token),
      to: rpcOption.to,
      value: rpcOption.value,
      gasLimit: rpcOption.gasLimit,
    }
  }

  private mapRpcFeeTokenToAddress(rpcToken: RpcFeeToken): Address.Address {
    if (rpcToken.type === FeeTokenType.ERC20_TOKEN && rpcToken.contractAddress) {
      return Address.from(rpcToken.contractAddress)
    }
    return '0x0000000000000000000000000000000000000000'
  }

  private mapPrimitivePreconditionToRpc(
    precondition: PrimitivePrecondition.Precondition,
    chainId: bigint,
  ): RpcIntentPrecondition {
    const chainIdStr = chainId.toString()
    const { type, ...data } = precondition

    const mappedData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, typeof value === 'bigint' ? value.toString() : value]),
    )

    return {
      type: type,
      chainID: chainIdStr,
      data: mappedData,
    }
  }
}
