import {
  Relayer as GenRelayer,
  SendMetaTxnReturn as RpcSendMetaTxnReturn,
  MetaTxn as RpcMetaTxn,
  FeeTokenType,
  IntentPrecondition,
} from './relayer.gen'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../relayer'
import { Address, Hex, Bytes, AbiFunction } from 'ox'
import { Payload, Precondition as PrimitivePrecondition } from '@0xsequence/wallet-primitives'
import {
  IntentPrecondition as RpcIntentPrecondition,
  ETHTxnStatus,
  FeeOption as RpcFeeOption,
  FeeToken as RpcFeeToken,
} from './relayer.gen'
import { decodePrecondition } from '../../preconditions'
import {
  erc20BalanceOf,
  erc20Allowance,
  erc721OwnerOf,
  erc721GetApproved,
  erc1155BalanceOf,
  erc1155IsApprovedForAll,
} from '../abi'
import { PublicClient, createPublicClient, http, Chain } from 'viem'
import * as chains from 'viem/chains'

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>

export const getChain = (chainId: number): Chain => {
  const chain = Object.values(chains).find((c) => c.id === chainId)
  if (!chain) {
    throw new Error(`Chain with id ${chainId} not found`)
  }
  return chain
}

export class RpcRelayer implements Relayer {
  public readonly id: string
  private client: GenRelayer
  private fetch: Fetch
  private provider: PublicClient

  constructor(hostname: string, chainId: number, rpcUrl: string, fetchImpl?: Fetch) {
    this.id = `rpc:${hostname}`
    const effectiveFetch = fetchImpl || (typeof window !== 'undefined' ? window.fetch.bind(window) : undefined)
    if (!effectiveFetch) {
      throw new Error('Fetch implementation is required but not available in this environment.')
    }
    this.fetch = effectiveFetch
    this.client = new GenRelayer(hostname, this.fetch)

    // Get the chain from the chainId
    const chain = getChain(chainId)

    // Create viem PublicClient with the provided RPC URL
    this.provider = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })
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

  async checkPrecondition(precondition: IntentPrecondition): Promise<boolean> {
    const decoded = decodePrecondition(precondition)

    if (!decoded) {
      return false
    }

    switch (decoded.type()) {
      case 'native-balance': {
        const native = decoded as any
        const balance = await this.provider.getBalance({ address: native.address.toString() as `0x${string}` })
        if (native.min !== undefined && native.max !== undefined) {
          return balance >= native.min && balance <= native.max
        }
        if (native.min !== undefined) {
          return balance >= native.min
        }
        if (native.max !== undefined) {
          return balance <= native.max
        }
        return false
      }

      case 'erc20-balance': {
        const erc20 = decoded as any
        const data = AbiFunction.encodeData(erc20BalanceOf, [erc20.address.toString()])
        const result = await this.provider.call({
          to: erc20.token.toString() as `0x${string}`,
          data: data as `0x${string}`,
        })
        const balance = BigInt(result.toString())
        if (erc20.min !== undefined && erc20.max !== undefined) {
          return balance >= erc20.min && balance <= erc20.max
        }
        if (erc20.min !== undefined) {
          return balance >= erc20.min
        }
        if (erc20.max !== undefined) {
          return balance <= erc20.max
        }
        return false
      }

      case 'erc20-approval': {
        const erc20 = decoded as any
        const data = AbiFunction.encodeData(erc20Allowance, [erc20.address.toString(), erc20.operator.toString()])
        const result = await this.provider.call({
          to: erc20.token.toString() as `0x${string}`,
          data: data as `0x${string}`,
        })
        const allowance = BigInt(result.toString())
        if (allowance >= erc20.min) {
          return true
        }
        return false
      }

      case 'erc721-ownership': {
        const erc721 = decoded as any
        const data = AbiFunction.encodeData(erc721OwnerOf, [erc721.tokenId])
        const result = await this.provider.call({
          to: erc721.token.toString() as `0x${string}`,
          data: data as `0x${string}`,
        })
        const resultHex = result.toString() as `0x${string}`
        const owner = resultHex.slice(-40)
        const isOwner = owner.toLowerCase() === erc721.address.toString().slice(2).toLowerCase()
        if (erc721.owned !== undefined && isOwner) {
          return true
        }
        return false
      }

      case 'erc721-approval': {
        const erc721 = decoded as any
        const data = AbiFunction.encodeData(erc721GetApproved, [erc721.tokenId])
        const result = await this.provider.call({
          to: erc721.token.toString() as `0x${string}`,
          data: data as `0x${string}`,
        })
        const resultHex = result.toString() as `0x${string}`
        const approved = resultHex.slice(-40)
        if (approved.toLowerCase() !== erc721.operator.toString().slice(2).toLowerCase()) {
          return true
        }
        return false
      }

      case 'erc1155-balance': {
        const erc1155 = decoded as any
        const data = AbiFunction.encodeData(erc1155BalanceOf, [erc1155.address.toString(), erc1155.tokenId])
        const result = await this.provider.call({
          to: erc1155.token.toString() as `0x${string}`,
          data: data as `0x${string}`,
        })
        const balance = BigInt(result.toString())
        if (erc1155.min !== undefined && erc1155.max !== undefined) {
          return balance >= erc1155.min && balance <= erc1155.max
        }
        if (erc1155.min !== undefined) {
          return balance >= erc1155.min
        }
        if (erc1155.max !== undefined) {
          return balance <= erc1155.max
        }
        return false
      }

      case 'erc1155-approval': {
        const erc1155 = decoded as any
        const data = AbiFunction.encodeData(erc1155IsApprovedForAll, [
          erc1155.address.toString(),
          erc1155.operator.toString(),
        ])
        const result = await this.provider.call({
          to: erc1155.token.toString() as `0x${string}`,
          data: data as `0x${string}`,
        })
        if (BigInt(result.toString()) !== 1n) {
          return true
        }
        return false
      }

      default:
        return false
    }
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
