import {
  Relayer as GenRelayer,
  SendMetaTxnReturn as RpcSendMetaTxnReturn,
  MetaTxn as RpcMetaTxn,
  FeeTokenType,
  IntentPrecondition,
  GetMetaTxnReceiptReturn,
} from './relayer.gen.js'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../relayer.js'
import { Address, Hex, Bytes, AbiFunction } from 'ox'
import { Payload, Precondition as PrimitivePrecondition } from '@0xsequence/wallet-primitives'
import {
  IntentPrecondition as RpcIntentPrecondition,
  ETHTxnStatus,
  FeeOption as RpcFeeOption,
  FeeToken as RpcFeeToken,
} from './relayer.gen.js'
import { decodePrecondition } from '../../preconditions/index.js'
import {
  erc20BalanceOf,
  erc20Allowance,
  erc721OwnerOf,
  erc721GetApproved,
  erc1155BalanceOf,
  erc1155IsApprovedForAll,
} from '../abi.js'
import { PublicClient, createPublicClient, http, Chain } from 'viem'
import * as chains from 'viem/chains'

export * from './relayer.gen.js'

export type Fetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>

export const getChain = (chainId: number): Chain => {
  const chain = Object.values(chains).find((c: any) => typeof c === 'object' && 'id' in c && c.id === chainId)
  if (!chain) {
    throw new Error(`Chain with id ${chainId} not found`)
  }
  return chain as Chain
}

export class RpcRelayer implements Relayer {
  public readonly id: string
  public readonly chainId: number
  private client: GenRelayer
  private fetch: Fetch
  private provider: PublicClient

  constructor(hostname: string, chainId: number, rpcUrl: string, fetchImpl?: Fetch) {
    this.id = `rpc:${hostname}`
    this.chainId = chainId
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

  async sendMetaTxn(
    walletAddress: Address.Address,
    to: Address.Address,
    data: Hex.Hex,
    chainId: bigint,
    quote?: FeeQuote,
    preconditions?: IntentPrecondition[],
  ): Promise<{ opHash: Hex.Hex }> {
    console.log('sendMetaTxn', walletAddress, to, data, chainId, quote, preconditions)
    const rpcCall: RpcMetaTxn = {
      walletAddress: walletAddress,
      contract: to,
      input: data,
    }

    const result: RpcSendMetaTxnReturn = await this.client.sendMetaTxn({
      call: rpcCall,
      quote: quote ? JSON.stringify(quote._quote) : undefined,
      preconditions: preconditions,
    })

    if (!result.status) {
      console.error('RpcRelayer.relay failed', result)
      throw new Error(`Relay failed: TxnHash ${result.txnHash}`)
    }

    return { opHash: Hex.fromString(result.txnHash) }
  }

  async relay(
    to: Address.Address,
    data: Hex.Hex,
    chainId: bigint,
    quote?: FeeQuote,
    preconditions?: IntentPrecondition[],
  ): Promise<{ opHash: Hex.Hex }> {
    console.log('relay', to, data, chainId, quote, preconditions)
    const rpcCall: RpcMetaTxn = {
      walletAddress: to,
      contract: to,
      input: data,
    }

    const result: RpcSendMetaTxnReturn = await this.client.sendMetaTxn({
      call: rpcCall,
      quote: quote ? JSON.stringify(quote._quote) : undefined,
      preconditions: preconditions,
    })

    if (!result.status) {
      console.error('RpcRelayer.relay failed', result)
      throw new Error(`Relay failed: TxnHash ${result.txnHash}`)
    }

    return { opHash: Hex.fromString(result.txnHash) }
  }

  async status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus> {
    try {
      const cleanedOpHash = opHash.startsWith('0x') ? opHash.substring(2) : opHash
      const result = await this.client.getMetaTxnReceipt({ metaTxID: cleanedOpHash })
      const receipt = result.receipt

      if (!receipt) {
        console.warn(`RpcRelayer.status: receipt not found for opHash ${opHash}`)
        return { status: 'unknown' }
      }

      if (!receipt.status) {
        console.warn(`RpcRelayer.status: receipt status not found for opHash ${opHash}`)
        return { status: 'unknown' }
      }

      switch (receipt.status as ETHTxnStatus) {
        case ETHTxnStatus.QUEUED:
        case ETHTxnStatus.PENDING_PRECONDITION:
        case ETHTxnStatus.SENT:
          return { status: 'pending' }
        case ETHTxnStatus.SUCCEEDED:
          return { status: 'confirmed', transactionHash: receipt.txnHash as Hex.Hex, data: result }
        case ETHTxnStatus.FAILED:
        case ETHTxnStatus.PARTIALLY_FAILED:
          return {
            status: 'failed',
            transactionHash: receipt.txnHash ? (receipt.txnHash as Hex.Hex) : undefined,
            reason: receipt.revertReason || 'Relayer reported failure',
            data: result,
          }
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
        try {
          const balance = await this.provider.getBalance({ address: native.address.toString() as `0x${string}` })
          const minWei = native.min !== undefined ? BigInt(native.min) : undefined
          const maxWei = native.max !== undefined ? BigInt(native.max) : undefined

          if (minWei !== undefined && maxWei !== undefined) {
            return balance >= minWei && balance <= maxWei
          }
          if (minWei !== undefined) {
            return balance >= minWei
          }
          if (maxWei !== undefined) {
            return balance <= maxWei
          }
          // If no min or max specified, this is an invalid precondition
          console.warn('Native balance precondition has neither min nor max specified')
          return false
        } catch (error) {
          console.error('Error checking native balance:', error)
          return false
        }
      }

      case 'erc20-balance': {
        const erc20 = decoded as any
        try {
          const data = AbiFunction.encodeData(erc20BalanceOf, [erc20.address.toString()])
          const result = await this.provider.call({
            to: erc20.token.toString() as `0x${string}`,
            data: data as `0x${string}`,
          })
          const balance = BigInt(result.toString())
          const minWei = erc20.min !== undefined ? BigInt(erc20.min) : undefined
          const maxWei = erc20.max !== undefined ? BigInt(erc20.max) : undefined

          if (minWei !== undefined && maxWei !== undefined) {
            return balance >= minWei && balance <= maxWei
          }
          if (minWei !== undefined) {
            return balance >= minWei
          }
          if (maxWei !== undefined) {
            return balance <= maxWei
          }
          console.warn('ERC20 balance precondition has neither min nor max specified')
          return false
        } catch (error) {
          console.error('Error checking ERC20 balance:', error)
          return false
        }
      }

      case 'erc20-approval': {
        const erc20 = decoded as any
        try {
          const data = AbiFunction.encodeData(erc20Allowance, [erc20.address.toString(), erc20.operator.toString()])
          const result = await this.provider.call({
            to: erc20.token.toString() as `0x${string}`,
            data: data as `0x${string}`,
          })
          const allowance = BigInt(result.toString())
          const minAllowance = BigInt(erc20.min)
          return allowance >= minAllowance
        } catch (error) {
          console.error('Error checking ERC20 approval:', error)
          return false
        }
      }

      case 'erc721-ownership': {
        const erc721 = decoded as any
        try {
          const data = AbiFunction.encodeData(erc721OwnerOf, [erc721.tokenId])
          const result = await this.provider.call({
            to: erc721.token.toString() as `0x${string}`,
            data: data as `0x${string}`,
          })
          const resultHex = result.toString() as `0x${string}`
          const owner = resultHex.slice(-40)
          const isOwner = owner.toLowerCase() === erc721.address.toString().slice(2).toLowerCase()
          const expectedOwnership = erc721.owned !== undefined ? erc721.owned : true
          return isOwner === expectedOwnership
        } catch (error) {
          console.error('Error checking ERC721 ownership:', error)
          return false
        }
      }

      case 'erc721-approval': {
        const erc721 = decoded as any
        try {
          const data = AbiFunction.encodeData(erc721GetApproved, [erc721.tokenId])
          const result = await this.provider.call({
            to: erc721.token.toString() as `0x${string}`,
            data: data as `0x${string}`,
          })
          const resultHex = result.toString() as `0x${string}`
          const approved = resultHex.slice(-40)
          return approved.toLowerCase() === erc721.operator.toString().slice(2).toLowerCase()
        } catch (error) {
          console.error('Error checking ERC721 approval:', error)
          return false
        }
      }

      case 'erc1155-balance': {
        const erc1155 = decoded as any
        try {
          const data = AbiFunction.encodeData(erc1155BalanceOf, [erc1155.address.toString(), erc1155.tokenId])
          const result = await this.provider.call({
            to: erc1155.token.toString() as `0x${string}`,
            data: data as `0x${string}`,
          })
          const balance = BigInt(result.toString())
          const minWei = erc1155.min !== undefined ? BigInt(erc1155.min) : undefined
          const maxWei = erc1155.max !== undefined ? BigInt(erc1155.max) : undefined

          if (minWei !== undefined && maxWei !== undefined) {
            return balance >= minWei && balance <= maxWei
          }
          if (minWei !== undefined) {
            return balance >= minWei
          }
          if (maxWei !== undefined) {
            return balance <= maxWei
          }
          console.warn('ERC1155 balance precondition has neither min nor max specified')
          return false
        } catch (error) {
          console.error('Error checking ERC1155 balance:', error)
          return false
        }
      }

      case 'erc1155-approval': {
        const erc1155 = decoded as any
        try {
          const data = AbiFunction.encodeData(erc1155IsApprovedForAll, [
            erc1155.address.toString(),
            erc1155.operator.toString(),
          ])
          const result = await this.provider.call({
            to: erc1155.token.toString() as `0x${string}`,
            data: data as `0x${string}`,
          })
          return BigInt(result.toString()) === 1n
        } catch (error) {
          console.error('Error checking ERC1155 approval:', error)
          return false
        }
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
}
