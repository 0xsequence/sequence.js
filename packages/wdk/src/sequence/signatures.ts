import { Address, Bytes, Hex } from 'ox'
import * as Db from '../dbs'
import { Config, Payload } from '@0xsequence/sequence-primitives'
import { Envelope } from '@0xsequence/sequence-core'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager'
import { Handler } from './handlers'
import { BaseSignatureRequest, SignatureRequest, SignerBase, SignerSigned, SignerUnavailable } from './types'

export class Signatures {
  constructor(private readonly shared: Shared) {}

  async list(): Promise<Db.SignatureRequest[]> {
    return this.shared.databases.signatures.list()
  }

  async get(requestId: string): Promise<SignatureRequest> {
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

        if (!sak.kind) {
          return {
            ...base,
            handler: undefined,
            reason: 'unknown-signer-kind',
            status: 'unavailable',
          } as SignerUnavailable
        }

        const handler = this.shared.handlers.get(sak.kind)
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
            reason: 'no-handler',
            status: 'unavailable',
          } as SignerUnavailable
        }

        return handler.status(sak.address, sak.imageHash, request)
      }),
    )

    return {
      ...request,
      ...Envelope.weightOf(request.envelope),
      signers: statuses,
    }
  }

  onSignatureRequestUpdate(
    requestId: string,
    cb: (requests: SignatureRequest) => void,
    onError?: (error: Error) => void,
    trigger?: boolean,
  ) {
    const undoDbListener = this.shared.databases.signatures.addListener(() => {
      this.get(requestId)
        .then((request) => cb(request))
        .catch((error) => onError?.(error))
    })

    const undoHandlerListeners = Object.values(this.shared.handlers).map((handler) =>
      handler.onStatusChange(() => {
        this.get(requestId)
          .then((request) => cb(request))
          .catch((error) => onError?.(error))
      }),
    )

    if (trigger) {
      this.get(requestId)
        .then((request) => cb(request))
        .catch((error) => onError?.(error))
    }

    return () => {
      undoDbListener()
      undoHandlerListeners.forEach((undoFn) => undoFn())
    }
  }

  onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean) {
    const undo = this.shared.databases.signatures.addListener(() => {
      this.list().then((l) => cb(l))
    })

    if (trigger) {
      this.list().then((l) => cb(l))
    }

    return undo
  }

  async complete(requestId: string) {
    await this.shared.databases.signatures.del(requestId)
  }

  async request<A extends Db.Action>(
    envelope: Envelope.Envelope<Db.ActionToPayload[A]>,
    action: A,
    options: {
      origin?: string
    },
  ): Promise<string> {
    const id = uuidv7()

    await this.shared.databases.signatures.set({
      id,
      wallet: envelope.wallet,
      envelope: Envelope.toSigned(envelope),
      origin: options.origin ?? 'unknown',
      action,
      createdAt: new Date().toISOString(),
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

  async delete(requestId: string) {
    await this.shared.databases.signatures.del(requestId)
  }
}
