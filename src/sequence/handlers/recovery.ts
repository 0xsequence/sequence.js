import { Address } from 'ox/Address'
import { BaseSignatureRequest, SignerUnavailable, SignerReady, SignerActionable, Kinds } from '../types/index.js'
import { Handler } from './handler.js'
import { Recovery } from '../recovery.js'
import { Payload } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'
import { Signatures } from '../signatures.js'

export class RecoveryHandler implements Handler {
  kind = Kinds.Recovery

  constructor(
    private readonly signatures: Signatures,
    public readonly recovery: Recovery,
  ) {}

  onStatusChange(cb: () => void): () => void {
    return this.recovery.onQueuedPayloadsUpdate(undefined, cb)
  }

  async status(
    address: Address,
    imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable> {
    const queued = await this.recovery.getQueuedRecoveryPayloads(request.wallet, request.envelope.chainId)

    // If there is no queued payload for this request then we are unavailable
    const requestHash = Hex.fromBytes(
      Payload.hash(request.envelope.wallet, request.envelope.chainId, request.envelope.payload),
    )
    const found = queued.find((p) => p.payloadHash === requestHash)
    if (!found) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'no-recovery-payload-queued',
      }
    }

    if (!imageHash) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'no-image-hash',
      }
    }

    if (found.endTimestamp > Date.now() / 1000) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'timelock-not-met',
      }
    }

    try {
      const signature = await this.recovery.encodeRecoverySignature(imageHash, found.signer)

      return {
        address,
        handler: this,
        status: 'ready',
        handle: async () => {
          this.signatures.addSignature(request.id, {
            imageHash,
            signature: {
              address,
              data: Hex.fromBytes(signature),
              type: 'sapient_compact',
            },
          })
          return true
        },
      }
    } catch (e) {
      return {
        address,
        handler: this,
        status: 'unavailable',
        reason: 'failed-to-encode-recovery-signature',
      }
    }
  }
}
