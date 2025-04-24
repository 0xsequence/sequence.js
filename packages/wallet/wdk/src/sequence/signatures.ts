import { Envelope } from '@0xsequence/wallet-core'
import { Config, Payload } from '@0xsequence/wallet-primitives'
import { Hex } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager.js'
import {
  Action,
  ActionToPayload,
  BaseSignatureRequest,
  SignatureRequest,
  SignerBase,
  SignerSigned,
  SignerUnavailable,
} from './types/signature-request.js'

export class Signatures {
  constructor(private readonly shared: Shared) {}

  private async getBase(requestId: string): Promise<BaseSignatureRequest> {
    const request = await this.shared.databases.signatures.get(requestId)
    if (!request) {
      throw new Error(`Request not found for ${requestId}`)
    }
    return request
  }

  async list(): Promise<SignatureRequest[]> {
    return this.shared.databases.signatures.list() as any as SignatureRequest[]
  }

  async get(requestId: string): Promise<SignatureRequest> {
    const request = await this.getBase(requestId)

    if (request.status !== 'pending' && request.scheduledPruning < Date.now()) {
      await this.shared.databases.signatures.del(requestId)
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
    const request = await this.getBase(requestId)

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
      await Promise.all(pendingConfigUpdatesToClear.map((sig) => this.shared.modules.signatures.cancel(sig.id)))
    }

    await this.shared.databases.signatures.set({
      ...request,
      status: 'completed',
      scheduledPruning: Date.now() + this.shared.databases.pruningInterval,
    })
  }

  async request<A extends Action>(
    envelope: Envelope.Envelope<ActionToPayload[A]>,
    action: A,
    options: {
      origin?: string
    } = {},
  ): Promise<string> {
    // If the action is a config update, we need to remove all signature requests
    // for the same wallet that also involve configuration updates
    // as it may cause race conditions
    // TODO: Eventually we should define a "delta configuration" signature request
    if (Payload.isConfigUpdate(envelope.payload)) {
      const pendingRequests = await this.shared.databases.signatures.list()
      const pendingConfigUpdatesToClear = pendingRequests.filter(
        (sig) => sig.wallet === envelope.wallet && Payload.isConfigUpdate(sig.envelope.payload),
      )

      console.warn(
        'Deleting conflicting configuration updates for wallet',
        envelope.wallet,
        pendingConfigUpdatesToClear.map((pc) => pc.id),
      )
      await Promise.all(pendingConfigUpdatesToClear.map((sig) => this.shared.modules.signatures.cancel(sig.id)))
    }

    const id = uuidv7()

    await this.shared.databases.signatures.set({
      id,
      wallet: envelope.wallet,
      envelope: Envelope.toSigned(envelope),
      origin: options.origin ?? 'unknown',
      action,
      createdAt: new Date().toISOString(),
      status: 'pending',
    })

    return id
  }

  async addSignature(requestId: string, signature: Envelope.SapientSignature | Envelope.Signature) {
    const request = await this.getBase(requestId)

    Envelope.addSignature(request.envelope, signature)

    await this.shared.databases.signatures.set(request)
  }

  async cancel(requestId: string) {
    const request = await this.getBase(requestId)

    await this.shared.databases.signatures.set({
      ...request,
      status: 'cancelled',
      scheduledPruning: Date.now() + this.shared.databases.pruningInterval,
    })
  }

  async prune() {
    const now = Date.now()
    const requests = await this.shared.databases.signatures.list()
    const toPrune = requests.filter((req) => req.status !== 'pending' && req.scheduledPruning < now)
    await Promise.all(toPrune.map((req) => this.shared.databases.signatures.del(req.id)))
    return toPrune.length
  }
}
