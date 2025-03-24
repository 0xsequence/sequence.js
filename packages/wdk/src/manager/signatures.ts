import { Address, Bytes, Hex } from 'ox'
import * as Db from '../dbs'
import { Config, Payload } from '@0xsequence/sequence-primitives'
import { Envelope } from '@0xsequence/sequence-core'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager'
import { Handler } from './handlers'

export type SignerBase = {
  address: Address.Address
  imageHash?: Bytes.Bytes
}

export type SignerSigned = SignerBase & {
  handler?: Handler
  status: 'signed'
}

export type SignerUnavailable = SignerBase & {
  handler?: Handler
  reason: string
  status: 'unavailable'
}

export type SignerReady = SignerBase & {
  handler: Handler
  status: 'ready'
  handle: () => Promise<boolean>
}

export type SignerActionable = SignerBase & {
  handler: Handler
  status: 'actionable'
  message: string // TODO: Localization?
  handle: () => Promise<boolean>
}

export type Signer = SignerSigned | SignerUnavailable | SignerReady | SignerActionable

export type SignatureRequest = Db.SignatureRequest & {
  signers: Signer[]
}

export class Signatures {
  constructor(private readonly shared: Shared) {}

  async list(): Promise<Db.SignatureRequest[]> {
    return this.shared.databases.signatures.list()
  }

  async request(
    envelope: Envelope.Envelope<Payload.Payload>,
    options: {
      origin?: string
      reason?: string
    },
  ): Promise<string> {
    const id = uuidv7()

    await this.shared.databases.signatures.set({
      id,
      wallet: envelope.wallet,
      envelope: Envelope.toSigned(envelope),
      origin: options.origin ?? 'unknown',
      reason: options.reason ?? 'unknown',
      status: 'pending',
    })

    return id
  }

  async addSignature(requestId: string, signature: Envelope.SapientSignature | Envelope.Signature) {
    const request = await this.shared.databases.signatures.get(requestId)
    if (!request) {
      throw new Error(`Request not found for ${requestId}`)
    }

    Envelope.addSignature(request.envelope, signature)

    await this.shared.databases.signatures.set(request)
  }

  async sign(requestId: string, onSigners: (signers: Signer[]) => void): Promise<boolean> {
    const request = await this.shared.databases.signatures.get(requestId)
    if (!request) {
      throw new Error(`Request not found for ${requestId}`)
    }

    const signers = Config.getSigners(request.envelope.configuration.topology)
    const signersAndKinds = await Promise.all([
      ...signers.signers.map(async (signer) => {
        const kind = await this.shared.modules.signers.kindOf(request.wallet, signer)
        return {
          address: signer,
          imageHash: undefined,
          kind,
        }
      }),
      ...signers.sapientSigners.map(async (signer) => {
        const kind = await this.shared.modules.signers.kindOf(
          request.wallet,
          signer.address,
          Hex.from(signer.imageHash),
        )
        return {
          address: signer.address,
          imageHash: signer.imageHash,
          kind,
        }
      }),
    ])

    const statuses = await Promise.all(
      signersAndKinds.map(async (sak) => {
        const base = {
          address: sak.address,
          imageHash: sak.imageHash,
        } as SignerBase

        // We may have a signature for this signer already
        const signed = request.envelope.signatures.some((sig) => {
          if (Envelope.isSapientSignature(sig)) {
            return sig.signature.address === sak.address && sig.imageHash === sak.imageHash
          }
          return sig.address === sak.address
        })

        const handler = sak.kind && this.shared.handlers.get(sak.kind)
        if (signed) {
          return {
            ...base,
            handler,
            status: 'signed',
          } as SignerSigned
        }

        if (!handler) {
          return {
            ...base,
            handler: undefined,
            reason: 'unknown-kind',
            status: 'unavailable',
          } as SignerUnavailable
        }

        return handler.status(sak.address, sak.imageHash, request)
      }),
    )

    onSigners(statuses)

    return false
  }
}
