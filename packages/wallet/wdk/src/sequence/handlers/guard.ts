import { Address, Hex } from 'ox'
import { Handler } from './handler.js'
import { Guard } from '../guard.js'
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable, Kinds } from '../types/index.js'
import { Signatures } from '../signatures.js'

export class GuardHandler implements Handler {
  kind = Kinds.Guard

  constructor(
    private readonly signatures: Signatures,
    private readonly guard: Guard,
  ) {}

  onStatusChange(cb: () => void): () => void {
    return () => {}
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
    // TODO: check if 2FA is required. If it is, return 'actionable'

    return {
      address,
      handler: this,
      status: 'ready',
      handle: async () => {
        const signature = await this.guard.sign(
          request.envelope.wallet,
          request.envelope.chainId,
          request.envelope.payload,
        )
        await this.signatures.addSignature(request.id, {
          address,
          signature,
        })
        return true
      },
    }
  }
}
