import { Envelope } from '@0xsequence/wallet-core'
import { Config } from '@0xsequence/wallet-primitives'
import { v7 as uuidv7 } from 'uuid'
import * as Db from '../dbs'
import { Shared } from './manager'
import { BaseSignatureRequest, SignatureRequest, SignerBase, SignerSigned, SignerUnavailable } from './types'

export class Signatures {
  constructor(private readonly shared: Shared) {}

  async list(): Promise<SignatureRequest[]> {
    return this.shared.databases.signatures.list() as any as SignatureRequest[]
  }

  async get(requestId: string): Promise<SignatureRequest> {
    const request = await this.shared.databases.signatures.get(requestId)
    if (!request) {
      throw new Error(`Request not found for ${requestId}`)
    }

    const signers = Config.getSigners(request.envelope.configuration.topology)
    const signersAndKinds = await this.shared.modules.signers.resolveKinds(request.wallet, [
      ...signers.signers,
      ...signers.sapientSigners.map((s) => ({ address: s.address, imageHash: s.imageHash })),
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
    } as SignatureRequest
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

    const undoHandlerListeners = Array.from(this.shared.handlers.values()).map((handler) =>
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
    const request = await this.shared.databases.signatures.get(requestId)
    if (request?.envelope.payload.type === 'config-update') {
      // Clear pending config updates for the same wallet with a checkpoint equal or lower than the completed update
      const pendingRequests = await this.shared.databases.signatures.list()
      const pendingConfigUpdatesToClear = pendingRequests.filter(
        (sig) =>
          sig.wallet === request.wallet &&
          sig.envelope.payload.type === 'config-update' &&
          sig.envelope.configuration.checkpoint <= request.envelope.configuration.checkpoint,
      )
      // This also deletes the requested id
      await Promise.all(pendingConfigUpdatesToClear.map((sig) => this.shared.modules.signatures.delete(sig.id)))
    } else {
      await this.shared.databases.signatures.del(requestId)
    }
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
