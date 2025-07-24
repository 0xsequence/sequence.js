import { Kinds } from '../types/signer.js'
import { Signatures } from '../signatures.js'
import { Hex } from 'ox'
import { Devices } from '../devices.js'
import { Handler } from './handler.js'
import { SignerReady, SignerUnavailable, BaseSignatureRequest } from '../types/index.js'

export class DevicesHandler implements Handler {
  kind = Kinds.LocalDevice

  constructor(
    private readonly signatures: Signatures,
    private readonly devices: Devices,
  ) {}

  onStatusChange(cb: () => void): () => void {
    return () => {}
  }

  async status(
    address: Address.Address,
    _imageHash: Hex.Hex | undefined,
    request: BaseSignatureRequest,
  ): Promise<SignerUnavailable | SignerReady> {
    const signer = await this.devices.get(address)
    if (!signer) {
      const status: SignerUnavailable = {
        address,
        handler: this,
        reason: 'not-local-key',
        status: 'unavailable',
      }
      return status
    }

    const status: SignerReady = {
      address,
      handler: this,
      status: 'ready',
      handle: async () => {
        const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload)

        await this.signatures.addSignature(request.id, {
          address,
          signature,
        })

        return true
      },
    }
    return status
  }
}
