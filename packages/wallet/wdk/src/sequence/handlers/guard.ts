import { Address, Hex } from 'ox'
import { Signers } from '@0xsequence/wallet-core'
import { Handler } from './handler.js'
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable, Kinds } from '../types/index.js'
import { Signatures } from '../signatures.js'

export class GuardHandler implements Handler {
  kind = Kinds.Guard

  constructor(
    private readonly signatures: Signatures,
    private readonly guard: Signers.Guard,
  ) {}

  onStatusChange(cb: () => void): () => void {
    return () => {}
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
    if (request.envelope.signatures.length === 0) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'must-not-sign-first',
      }
    }

    // TODO: check if 2FA is required. If it is, return 'actionable'

    return {
      address,
      handler: this,
      status: 'ready',
      handle: async () => {
        const signature = await this.guard.signEnvelope(request.envelope)
        await this.signatures.addSignature(request.id, signature)
        return true
      },
    }
  }
}
