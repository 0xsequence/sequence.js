import * as Db from '../dbs'
import { Kinds } from '../manager/signers'
import { Signatures, SignerReady, SignerUnavailable } from '../manager/signatures'
import { Address, Bytes } from 'ox'
import { Devices } from '../manager/devices'
import { Handler } from '../manager/handlers'

export class DeviceSignerHandler implements Handler {
  kind = Kinds.LocalDevice

  constructor(
    private readonly signatures: Signatures,
    private readonly devices: Devices,
  ) {}

  uiStatus(): 'non-required' {
    return 'non-required'
  }

  async status(
    address: Address.Address,
    _imageHash: Bytes.Bytes | undefined,
    request: Db.SignatureRequest,
  ): Promise<SignerUnavailable | SignerReady> {
    const signer = await this.devices.get(address)
    if (!signer) {
      return {
        address,
        handler: this,
        reason: 'not-local-key',
        status: 'unavailable',
      } as SignerUnavailable
    }

    return {
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
    } as SignerReady
  }
}
