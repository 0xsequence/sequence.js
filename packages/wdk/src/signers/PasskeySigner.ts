import { Envelope, Signers } from '@0xsequence/sequence-core'
import { InteractiveSigner, InteractiveSignerStatus } from './signer'
import * as Db from '../dbs'
import { Address, Bytes } from 'ox'

export class PasskeySigner implements InteractiveSigner {
  address: Address.Address

  constructor(private readonly innerSigner: Signers.Passkey.Passkey) {
    this.address = this.innerSigner.address
  }

  icon(): string {
    return 'passkey'
  }

  label(): string {
    return `Passkey - ${this.innerSigner.metadata?.name || 'Unknown'}`
  }

  prepare(_request: Db.SignatureRequest): void {
    // NO-OP
  }

  async sign(request: Db.SignatureRequest): Promise<Envelope.SapientSignature | Envelope.Signature> {
    const ie = request.envelope
    const ih = this.innerSigner.imageHash
    const signature = await this.innerSigner.signSapient(ie.wallet, ie.chainId, ie.payload, ih)
    return {
      imageHash: Bytes.from(ih),
      signature,
    }
  }

  status(_requestId?: string): InteractiveSignerStatus {
    return {
      // TODO: Handle localisation
      message: 'Request interaction with passkey',
      status: 'ready',
    }
  }
}
