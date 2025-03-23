import { AbiFunction, Address, Bytes, Hex } from 'ox'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from './relayer'
import { Constants, Payload } from '@0xsequence/sequence-primitives'

export interface GenericProvider {
  sendTransaction(args: { to: string; data: string }): Promise<string>
}

export class LocalRelayer implements Relayer {
  public readonly id = 'local'

  constructor(public readonly provider: GenericProvider) {}

  feeOptions(
    wallet: Address.Address,
    chainId: bigint,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    return Promise.resolve({ options: [] })
  }

  private decodeCalls(data: Hex.Hex): Payload.Calls {
    const executeSelector = AbiFunction.getSelector(Constants.EXECUTE)

    let packedPayload
    if (data.startsWith(executeSelector)) {
      const decode = AbiFunction.decodeData(Constants.EXECUTE, data)
      packedPayload = decode[0]
    } else {
      packedPayload = data
    }

    return Payload.decode(Bytes.fromHex(packedPayload))
  }

  async relay(to: Address.Address, data: Hex.Hex, chainId: bigint, _?: FeeQuote): Promise<{ opHash: Hex.Hex }> {
    const hash = Payload.hash(to, chainId, this.decodeCalls(data))

    await this.provider.sendTransaction({
      to,
      data,
    })

    return { opHash: Hex.fromBytes(hash) }
  }

  status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus> {
    throw new Error('Method not implemented.')
  }
}
