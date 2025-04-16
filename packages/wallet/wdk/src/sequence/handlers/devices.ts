import * as Db from '../../dbs'
import { Kinds } from '../types/signer'
import { Signatures } from '../signatures'
import { Address, Hex } from 'ox'
import { Devices } from '../devices'
import { Handler } from '.'
import { SignerReady, SignerUnavailable } from '../types'

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
    request: Db.SignatureRequest,
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
