import { Address, Hex, TypedData } from 'ox'
import { GuardSigner } from '@0xsequence/guard'
import { Payload } from '@0xsequence/wallet-primitives'
import { Envelope } from '@0xsequence/wallet-core'
import { Handler } from './handler.js'
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable, Kinds } from '../types/index.js'
import { Signatures } from '../signatures.js'

export class GuardHandler implements Handler {
  kind = Kinds.Guard

  constructor(
    private readonly signatures: Signatures,
    private readonly guard: GuardSigner,
  ) {}

  onStatusChange(cb: () => void): () => void {
    return () => {}
  }

  async sign(request: BaseSignatureRequest): Promise<Envelope.Signature> {
    const digest = Payload.hash(request.envelope.wallet, request.envelope.chainId, request.envelope.payload)
    const typedData = Payload.toTyped(request.envelope.wallet, request.envelope.chainId, request.envelope.payload)
    const serialized = Hex.fromString(TypedData.serialize(typedData))

    const signature = await this.guard.sign(request.envelope.wallet, request.envelope.chainId, digest, serialized)

    return {
      address: this.guard.address,
      signature: {
        type: 'hash',
        ...signature,
      },
    }
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
        const signature = await this.sign(request)
        await this.signatures.addSignature(request.id, signature)
        return true
      },
    }
  }
}
