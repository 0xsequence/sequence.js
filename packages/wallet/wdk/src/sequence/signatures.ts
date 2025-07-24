import { Envelope } from '@0xsequence/wallet-core'
import { Address, Config, Payload } from '@0xsequence/wallet-primitives'
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

export interface SignaturesInterface {
  /**
   * Retrieves the detailed state of a specific signature request.
   *
   * This method returns a "fully hydrated" `SignatureRequest` object. It contains not only the
   * static data about the request (like the wallet, action, and payload) but also a dynamic,
   * up-to-the-moment list of all required signers and their current statuses (`ready`, `actionable`,
   * `signed`, `unavailable`). This is the primary method to use when you need to display an
   * interactive signing prompt to the user.
   *
   * @param requestId The unique identifier of the signature request to retrieve.
   * @returns A promise that resolves to the detailed `SignatureRequest` object.
   * @throws An error if the request is not found or if it has expired and been pruned from the database.
   * @see {SignatureRequest} for the detailed structure of the returned object.
   */
  get(requestId: string): Promise<SignatureRequest>

  /**
   * Returns a list of all signature requests across all wallets managed by this instance.
   *
   * This method is useful for displaying an overview of all pending and historical actions.
   * The returned objects are the `SignatureRequest` type but may not be as "live" as the object from `get()`.
   * For displaying an interactive UI for a specific request, it's recommended to use `get(requestId)`
   * or subscribe via `onSignatureRequestUpdate` to get the most detailed and real-time state.
   *
   * @returns A promise that resolves to an array of `BaseSignatureRequest` objects.
   */
  list(): Promise<BaseSignatureRequest[]>

  /**
   * Cancel a specific signature request.
   *
   * @param requestId
   */
  cancel(requestId: string): Promise<void>

  /**
   * Subscribes to real-time updates for a single, specific signature request.
   *
   * The provided callback is invoked whenever the state of the request changes. This is a powerful
   * feature for building reactive UIs, as the callback fires not only when the request's database
   * entry is updated (e.g., a signature is added) but also when the availability of its required
   * signers changes (e.g., an auth session expires).
   *
   * @param requestId The ID of the signature request to monitor.
   * @param cb The callback function to execute with the updated `SignatureRequest` object.
   * @param onError (Optional) A callback to handle errors that may occur during the update,
   *   such as the request being deleted or expiring.
   * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current
   *   state of the request upon registration.
   * @returns A function that, when called, will unsubscribe the listener and stop updates.
   */
  onSignatureRequestUpdate(
    requestId: string,
    cb: (request: SignatureRequest) => void,
    onError?: (error: Error) => void,
    trigger?: boolean,
  ): () => void

  /**
   * Subscribes to updates on the list of all signature requests.
   *
   * The callback is fired whenever a signature request is created, updated (e.g., its status
   * changes to 'completed' or 'cancelled'), or removed. This is ideal for keeping a list
   * view of all signature requests synchronized.
   *
   * The callback receives an array of `BaseSignatureRequest` objects, which contain the core,
   * static data for each request.
   *
   * @param cb The callback function to execute with the updated list of `BaseSignatureRequest` objects.
   * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current
   *   list of requests upon registration.
   * @returns A function that, when called, will unsubscribe the listener.
   */
  onSignatureRequestsUpdate(cb: (requests: BaseSignatureRequest[]) => void, trigger?: boolean): () => void
}

export class Signatures implements SignaturesInterface {
  constructor(private readonly shared: Shared) {}

  initialize() {
    this.shared.modules.cron.registerJob('prune-signatures', 10 * 60 * 1000, async () => {
      const prunedSignatures = await this.prune()
      if (prunedSignatures > 0) {
        this.shared.modules.logger.log(`Pruned ${prunedSignatures} signatures`)
      }
    })
    this.shared.modules.logger.log('Signatures module initialized and job registered.')
  }

  private async getBase(requestId: string): Promise<BaseSignatureRequest> {
    const request = await this.shared.databases.signatures.get(requestId)
    if (!request) {
      throw new Error(`Request not found for ${requestId}`)
    }
    return request
  }

  async list(): Promise<BaseSignatureRequest[]> {
    return this.shared.databases.signatures.list()
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
        const base: SignerBase = {
          address: sak.address,
          imageHash: sak.imageHash,
        }

        // We may have a signature for this signer already
        const signed = request.envelope.signatures.some((sig) => {
          if (Envelope.isSapientSignature(sig)) {
            return Address.isEqual(sig.signature.address, sak.address) && sig.imageHash === sak.imageHash
          }
          return Address.isEqual(sig.address, sak.address)
        })

        if (!sak.kind) {
          const status: SignerUnavailable = {
            ...base,
            handler: undefined,
            reason: 'unknown-signer-kind',
            status: 'unavailable',
          }
          return status
        }

        const handler = this.shared.handlers.get(sak.kind)
        if (signed) {
          const status: SignerSigned = {
            ...base,
            handler,
            status: 'signed',
          }
          return status
        }

        if (!handler) {
          const status: SignerUnavailable = {
            ...base,
            handler: undefined,
            reason: 'no-handler',
            status: 'unavailable',
          }
          return status
        }

        return handler.status(sak.address, sak.imageHash, request)
      }),
    )

    const signatureRequest: SignatureRequest = {
      ...request,
      ...Envelope.weightOf(request.envelope),
      signers: statuses,
    }
    return signatureRequest
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
          Address.isEqual(sig.wallet, request.wallet) &&
          sig.envelope.payload.type === 'config-update' &&
          sig.status === 'pending' &&
          sig.envelope.configuration.checkpoint <= request.envelope.configuration.checkpoint &&
          sig.id !== requestId,
      )
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
        (sig) => Address.isEqual(sig.wallet, envelope.wallet) && Payload.isConfigUpdate(sig.envelope.payload),
      )

      console.warn(
        'Deleting conflicting configuration updates for wallet',
        envelope.wallet,
        pendingConfigUpdatesToClear.map((pc) => pc.id),
      )
      const cancellationResults = await Promise.allSettled(
        pendingConfigUpdatesToClear.map((sig) => this.shared.modules.signatures.cancel(sig.id)),
      )
      cancellationResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const failedSigId = pendingConfigUpdatesToClear[index]?.id
          console.error(
            `Failed to cancel conflicting signature request ${failedSigId || 'unknown ID'} during logout preparation:`,
            result.reason,
          )
        }
      })
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
