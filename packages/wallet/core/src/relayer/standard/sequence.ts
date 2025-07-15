import { ETHTxnStatus, IntentPrecondition, Relayer as Service } from '@0xsequence/relayer'
import { Constants, Payload } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Bytes, Hex } from 'ox'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../relayer.js'

export class SequenceRelayer implements Relayer {
  public readonly kind: 'relayer' = 'relayer'
  public readonly type = 'sequence'
  readonly id = 'sequence'

  private readonly service: Service

  constructor(host: string) {
    this.service = new Service(host, fetch)
  }

  async isAvailable(_wallet: Address.Address, _chainId: bigint): Promise<boolean> {
    return true
  }

  async feeOptions(
    wallet: Address.Address,
    _chainId: bigint,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    const to = wallet // TODO: this might be the guest module
    const execute = AbiFunction.from('function execute(bytes calldata _payload, bytes calldata _signature)')
    const payload = Payload.encode({ type: 'call', space: 0n, nonce: 0n, calls }, to)
    const signature = '0x0001' // TODO: use a stub signature
    const data = AbiFunction.encodeData(execute, [Bytes.toHex(payload), signature])

    const { options, quote } = await this.service.feeOptions({ wallet, to, data })

    return {
      options: options.map(({ token: { contractAddress }, to, value, gasLimit }) => {
        let token: Address.Address
        if (contractAddress) {
          Address.assert(contractAddress)
          token = contractAddress
        } else {
          token = Constants.ZeroAddress
        }

        return { token, to, value, gasLimit }
      }),
      quote: quote ? { _tag: 'FeeQuote', _quote: quote } : undefined,
    }
  }

  async checkPrecondition(precondition: IntentPrecondition): Promise<boolean> {
    // TODO: implement
    return false
  }

  async relay(to: Address.Address, data: Hex.Hex, _chainId: bigint, quote?: FeeQuote): Promise<{ opHash: Hex.Hex }> {
    const walletAddress = to // TODO: pass wallet address or stop requiring it

    const { txnHash } = await this.service.sendMetaTxn({
      call: { walletAddress, contract: to, input: data },
      quote: quote && (quote._quote as string),
    })

    return { opHash: `0x${txnHash}` }
  }

  async status(opHash: Hex.Hex, _chainId: bigint): Promise<OperationStatus> {
    try {
      const {
        receipt: { status, revertReason, txnReceipt },
      } = await this.service.getMetaTxnReceipt({ metaTxID: opHash })

      switch (status) {
        case ETHTxnStatus.UNKNOWN:
          return { status: 'unknown' }

        case ETHTxnStatus.DROPPED:
          return { status: 'failed', reason: revertReason ?? status }

        case ETHTxnStatus.QUEUED:
          return { status: 'pending' }

        case ETHTxnStatus.SENT:
          return { status: 'pending' }

        case ETHTxnStatus.SUCCEEDED: {
          const receipt = JSON.parse(txnReceipt)
          const transactionHash = receipt.transactionHash
          Hex.assert(transactionHash)
          return { status: 'confirmed', transactionHash }
        }

        case ETHTxnStatus.PARTIALLY_FAILED:
          return { status: 'failed', reason: revertReason ?? status }

        case ETHTxnStatus.FAILED:
          return { status: 'failed', reason: revertReason ?? status }

        default:
          throw new Error(`unknown transaction status '${status}'`)
      }
    } catch {
      return { status: 'pending' }
    }
  }
}
