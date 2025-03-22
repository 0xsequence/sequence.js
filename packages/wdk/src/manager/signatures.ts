import { Address, Bytes, Hex, Provider } from 'ox'
import * as Db from '../dbs'
import { Config, Payload } from '@0xsequence/sequence-primitives'
import { Envelope } from '@0xsequence/sequence-core'
import { v7 as uuidv7 } from 'uuid'
import { Signers } from './signers'
import { SignerHandler } from '../signers/signer'

export type SignerBase = {
  address: Address.Address
  imageHash?: Bytes.Bytes
}

export type SignerSigned = SignerBase & {
  handler?: SignerHandler
  status: 'signed'
}

export type SignerUnavailable = SignerBase & {
  handler?: SignerHandler
  reason: string
  status: 'unavailable'
}

export type SignerReady = SignerBase & {
  handler: SignerHandler
  status: 'ready'
  sign: () => Promise<boolean>
}

export type SignerActionable = SignerBase & {
  handler: SignerHandler
  status: 'actionable'
  message: string // TODO: Localization?
  sign: () => Promise<boolean>
}

export type Signer = SignerSigned | SignerUnavailable | SignerReady | SignerActionable

export type SignatureRequest = Db.SignatureRequest & {
  signers: Signer[]
}

export class Signatures {
  constructor(
    private readonly signers: Signers,
    private readonly signaturesDb: Db.Signatures,
    private readonly handlers: Map<string, SignerHandler>,
  ) {}

  async list(): Promise<Db.SignatureRequest[]> {
    return this.signaturesDb.list()
  }

  async request(
    envelope: Envelope.Envelope<Payload.Payload>,
    options: {
      origin?: string
      reason?: string
    },
  ): Promise<string> {
    const id = uuidv7()

    await this.signaturesDb.set({
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
    const request = await this.signaturesDb.get(requestId)
    if (!request) {
      throw new Error(`Request not found for ${requestId}`)
    }

    Envelope.addSignature(request.envelope, signature)

    await this.signaturesDb.set(request)
  }

  async sign(requestId: string, onSigners: (signers: Signer[]) => void): Promise<boolean> {
    const request = await this.signaturesDb.get(requestId)
    if (!request) {
      throw new Error(`Request not found for ${requestId}`)
    }

    const signers = Config.getSigners(request.envelope.configuration.topology)
    const signersAndKinds = await Promise.all([
      ...signers.signers.map(async (signer) => {
        const kind = await this.signers.kindOf(request.wallet, signer)
        return {
          address: signer,
          imageHash: undefined,
          kind,
        }
      }),
      ...signers.sapientSigners.map(async (signer) => {
        const kind = await this.signers.kindOf(request.wallet, signer.address, Hex.from(signer.imageHash))
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

        const handler = sak.kind && this.handlers.get(sak.kind)
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
