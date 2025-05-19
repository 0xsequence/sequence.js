import { Envelope, Wallet } from '@0xsequence/wallet-core'
import { Payload } from '@0xsequence/wallet-primitives'
import { Address, Bytes, Hex, Provider, RpcTransport } from 'ox'
import { v7 as uuidv7 } from 'uuid'
import { Shared } from './manager.js'
import { Message, MessageRequest, MessageRequested, MessageSigned } from './types/message-request.js'

export class Messages {
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
