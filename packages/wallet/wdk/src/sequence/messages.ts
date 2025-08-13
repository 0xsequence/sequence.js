import { Envelope, Wallet } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Hex, Provider, RpcTransport } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager.js'
import { Message, MessageRequest, MessageRequested, MessageSigned } from './types/message-request.js'

export interface MessagesInterface {
  /**
   * Retrieves a list of all message requests, both pending and signed, across all wallets
   * managed by this instance.
   *
   * This is useful for displaying an overview or history of signing activities, or pending signature requests.
   *
   * @returns A promise that resolves to an array of `Message` objects.
   */
  list(): Promise<Message[]>

  /**
   * Retrieves the full state of a specific message request by its unique ID or its associated signature ID.
   * The returned `Message` object contains the complete context, including the envelope, status,
   * and, if signed, the final message signature.
   *
   * @param messageOrSignatureId The unique identifier of the message (`id`) or its corresponding signature request (`signatureId`).
   * @returns A promise that resolves to the `Message` object.
   * @throws An error if a message with the given ID is not found.
   */
  get(messageOrSignatureId: string): Promise<Message>

  /**
   * Initiates a request to sign a message.
   *
   * This method prepares a standard EIP-191 or EIP-712 payload, wraps it in a wallet-specific
   * `Envelope`, and creates a signature request. It does **not** sign the message immediately.
   * Instead, it returns a `signatureId` which is used to track the signing process.
   *
   * The actual signing is managed by the `Signatures` module, which handles collecting signatures
   * from the required signers (devices, passkeys, etc.).
   *
   * @param wallet The address of the wallet that will be signing the message.
   * @param message The message to be signed. Can be a plain string, a hex string, or an EIP-712 typed data object.
   * The SDK will handle the appropriate encoding.
   * @param chainId (Optional) The chain ID to include in the signature's EIP-712 domain separator.
   * This is crucial for replay protection if the signature is intended for on-chain verification. Use `0n` or `undefined` for off-chain signatures.
   * @param options (Optional) Additional metadata for the request.
   * @param options.source A string identifying the origin of the request (e.g., 'dapp.com', 'wallet-webapp').
   * @returns A promise that resolves to a unique `signatureId`. This ID should be used to interact with the `Signatures` module or to complete the signing process.
   * @see {SignaturesInterface} for managing the signing process.
   * @see {complete} to finalize the signature after it has been signed.
   */
  request(
    wallet: Address.Address,
    message: MessageRequest,
    chainId?: bigint,
    options?: { source?: string },
  ): Promise<string>

  /**
   * Finalizes a signed message request and returns the EIP-1271/EIP-6492 compliant signature.
   *
   * This method should be called after the associated signature request has been fulfilled (i.e.,
   * the required weight of signatures has been collected). It builds the final, encoded signature
   * string that can be submitted for verification. If the wallet is not yet deployed, the signature
   * will be automatically wrapped according to EIP-6492.
   *
   * If the message is already `signed`, this method is idempotent and will simply return the existing signature.
   *
   * @param messageOrSignatureId The ID of the message (`id`) or its signature request (`signatureId`).
   * @returns A promise that resolves to the final, EIP-1271/EIP-6492 compliant signature as a hex string.
   * @throws An error if the message request is not found or if the signature threshold has not been met.
   */
  complete(messageOrSignatureId: string): Promise<string>

  /**
   * Deletes a message request from the local database.
   * This action removes both the message record and its underlying signature request,
   * effectively canceling the signing process if it was still pending.
   *
   * @param messageOrSignatureId The ID of the message (`id`) or its signature request (`signatureId`) to delete.
   * @returns A promise that resolves when the deletion is complete. It does not throw if the item is not found.
   */
  delete(messageOrSignatureId: string): Promise<void>

  /**
   * Subscribes to updates for the list of all message requests.
   *
   * The callback is fired whenever a message is created, its status changes, or it is deleted.
   * This is ideal for keeping a high-level list view of message signing activities synchronized.
   *
   * @param cb The callback function to execute with the updated list of `Message` objects.
   * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current list of messages upon registration.
   * @returns A function that, when called, will unsubscribe the listener.
   */
  onMessagesUpdate(cb: (messages: Message[]) => void, trigger?: boolean): () => void

  /**
   * Subscribes to real-time updates for a single, specific message request.
   *
   * The callback is invoked whenever the state of the specified message changes.
   * This is useful for building reactive UI components that display the status of a
   * specific signing process.
   *
   * @param messageId The unique ID of the message to monitor.
   * @param cb The callback function to execute with the updated `Message` object.
   * @param trigger (Optional) If `true`, the callback will be immediately invoked with the current state of the message.
   * @returns A function that, when called, will unsubscribe the listener.
   */
  onMessageUpdate(messageId: string, cb: (message: Message) => void, trigger?: boolean): () => void
}

export class Messages implements MessagesInterface {
  constructor(private readonly shared: Shared) {}

  public async list(): Promise<Message[]> {
    return this.shared.databases.messages.list()
  }

  public async get(messageOrSignatureId: string): Promise<Message> {
    return this.getByMessageOrSignatureId(messageOrSignatureId)
  }

  private async getByMessageOrSignatureId(messageOrSignatureId: string): Promise<Message> {
    const messages = await this.list()
    const message = messages.find((m) => m.id === messageOrSignatureId || m.signatureId === messageOrSignatureId)
    if (!message) {
      throw new Error(`Message ${messageOrSignatureId} not found`)
    }
    return message
  }

  async request(
    from: Address.Address,
    message: MessageRequest,
    chainId?: bigint,
    options?: {
      source?: string
    },
  ): Promise<string> {
    const wallet = new Wallet(from, { stateProvider: this.shared.sequence.stateProvider })

    // Prepare message payload
    const envelope = await wallet.prepareMessageSignature(message, chainId ?? 0n)

    // Prepare signature request
    const signatureRequest = await this.shared.modules.signatures.request(envelope, 'sign-message', {
      origin: options?.source,
    })

    const id = uuidv7()
    await this.shared.databases.messages.set({
      id,
      wallet: from,
      message,
      envelope,
      source: options?.source ?? 'unknown',
      status: 'requested',
      signatureId: signatureRequest,
    } as MessageRequested)

    return signatureRequest
  }

  async complete(messageOrSignatureId: string): Promise<string> {
    const message = await this.getByMessageOrSignatureId(messageOrSignatureId)

    if (message.status === 'signed') {
      // Return the message signature
      return message.messageSignature
    }

    const messageId = message.id
    const signature = await this.shared.modules.signatures.get(message.signatureId)
    if (!signature) {
      throw new Error(`Signature ${message.signatureId} not found for message ${messageId}`)
    }

    if (!Payload.isMessage(message.envelope.payload) || !Payload.isMessage(signature.envelope.payload)) {
      throw new Error(`Message ${messageId} is not a message payload`)
    }

    if (!Envelope.isSigned(signature.envelope)) {
      throw new Error(`Message ${messageId} is not signed`)
    }

    const signatureEnvelope = signature.envelope as Envelope.Signed<Payload.Message>
    const { weight, threshold } = Envelope.weightOf(signatureEnvelope)
    if (weight < threshold) {
      throw new Error(`Message ${messageId} has insufficient weight`)
    }

    // Get the provider for the message chain
    let provider: Provider.Provider | undefined
    if (message.envelope.chainId !== 0n) {
      const network = this.shared.sequence.networks.find((network) => network.chainId === message.envelope.chainId)
      if (!network) {
        throw new Error(`Network not found for ${message.envelope.chainId}`)
      }
      const transport = RpcTransport.fromHttp(network.rpc)
      provider = Provider.from(transport)
    }

    const wallet = new Wallet(message.wallet, { stateProvider: this.shared.sequence.stateProvider })
    const messageSignature = Hex.from(await wallet.buildMessageSignature(signatureEnvelope, provider))

    await this.shared.databases.messages.set({
      ...message,
      envelope: signature.envelope,
      status: 'signed',
      messageSignature,
    } as MessageSigned)
    await this.shared.modules.signatures.complete(signature.id)

    return messageSignature
  }

  onMessagesUpdate(cb: (messages: Message[]) => void, trigger?: boolean) {
    const undo = this.shared.databases.messages.addListener(() => {
      this.list().then((l) => cb(l))
    })

    if (trigger) {
      this.list().then((l) => cb(l))
    }

    return undo
  }

  onMessageUpdate(messageId: string, cb: (message: Message) => void, trigger?: boolean) {
    const undo = this.shared.databases.messages.addListener(() => {
      this.get(messageId).then((t) => cb(t))
    })

    if (trigger) {
      this.get(messageId).then((t) => cb(t))
    }

    return undo
  }

  async delete(messageOrSignatureId: string) {
    try {
      const message = await this.getByMessageOrSignatureId(messageOrSignatureId)
      await this.shared.databases.signatures.del(message.signatureId)
      await this.shared.databases.messages.del(message.id)
    } catch (error) {
      // Ignore
    }
  }
}
