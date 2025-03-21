import { Envelope, Signers } from '@0xsequence/sequence-core'
import { InteractiveSigner, InteractiveSignerStatus } from './signer'
import * as Db from '../dbs'
import { Address } from 'ox'

export class DeviceSigner implements InteractiveSigner {
  address: Address.Address

  constructor(private readonly innerSigner: Signers.Pk.Pk) {
    this.address = this.innerSigner.address
  }

  icon(): string {
    return 'device'
  }

  label(): string {
    return 'Device (TODO add deterministic name)'
  }

  prepare(_request: Db.SignatureRequest): void {
    // NO-OP
  }

  async sign(request: Db.SignatureRequest): Promise<Envelope.SapientSignature | Envelope.Signature> {
    const ie = request.envelope
    const signature = await this.innerSigner.sign(ie.wallet, ie.chainId, ie.payload)
    return {
      address: this.address,
      signature,
    }
  }

  status(_requestId?: string): InteractiveSignerStatus {
    return {
      // TODO: Handle localisation
      message: 'Device is ready to sign',
      status: 'ready',
    }
  }
}
