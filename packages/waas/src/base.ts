import { ethers } from 'ethers'
import {
  GetSessionPacket,
  OpenSessionPacket,
  SessionPacketProof,
  ValidateSessionPacket,
  FinishValidateSessionPacket,
  closeSession,
  getSession,
  openSession,
  validateSession,
  finishValidateSession
} from './payloads/packets/session'
import { createSigner } from "./payloads/packets/signer";
import { LocalStore, Store, StoreObj } from './store'
import { BasePacket, Payload, signPacket } from './payloads'
import {
  TransactionsPacket,
  combinePackets,
  sendERC1155,
  sendERC20,
  sendERC721,
  sendTransactions,
  SendTransactionsArgs,
  SendERC20Args,
  SendERC721Args,
  SendERC1155Args,
  SendDelayedEncodeArgs,
  sendDelayedEncode
} from './payloads/packets/transactions'
import { OpenSessionResponse } from './payloads/responses'
import { SignMessageArgs, SignMessagePacket, signMessage } from './payloads/packets/messages'
import { SimpleNetwork, WithSimpleNetwork, toNetworkID } from './networks'

type status = 'pending' | 'signed-in' | 'signed-out'

const SEQUENCE_WAAS_WALLET_KEY = '@0xsequence.waas.wallet'
const SEQUENCE_WAAS_SESSION_KEY = '@0xsequence.waas.session'
const SEQUENCE_WAAS_SIGNER_KEY = '@0xsequence.waas.signer'
const SEQUENCE_WAAS_STATUS_KEY = '@0xsequence.waas.status'

// 5 minutes of default lifespan
const DEFAULT_LIFESPAN = 5 * 60

export type ExtraArgs = {
  lifespan?: number
}

export type ExtraTransactionArgs = ExtraArgs & {
  identifier: string
}

export type SequenceBaseConfig = {
  network: SimpleNetwork
}

export class SequenceWaaSBase {
  readonly VERSION = '0.0.0-dev1'

  private readonly status: StoreObj<status>
  private readonly sessionId: StoreObj<string | undefined>
  private readonly signer: StoreObj<string | undefined>
  private readonly wallet: StoreObj<string | undefined>

  constructor(
    public readonly config = { network: 1 } as SequenceBaseConfig,
    private readonly store: Store = new LocalStore()
  ) {
    this.status = new StoreObj(this.store, SEQUENCE_WAAS_STATUS_KEY, 'signed-out')
    this.sessionId = new StoreObj(this.store, SEQUENCE_WAAS_SESSION_KEY, undefined)
    this.signer = new StoreObj(this.store, SEQUENCE_WAAS_SIGNER_KEY, undefined)
    this.wallet = new StoreObj(this.store, SEQUENCE_WAAS_WALLET_KEY, undefined)
  }

  async getAddress() {
    return this.getWalletAddress()
  }

  private async getWalletAddress() {
    if (!(await this.isSignedIn())) {
      throw new Error('Not signed in')
    }

    const wallet = await this.wallet.get()
    if (!wallet) {
      throw new Error('No wallet')
    }

    return wallet
  }

  private async commonArgs<T>(
    args: T & {
      identifier: string
      lifespan?: number
      network?: SimpleNetwork
    }
  ): Promise<
    T & {
      identifier: string
      wallet: string
      lifespan: number
      chainId: number
    }
  > {
    return {
      ...args,
      identifier: args?.identifier,
      wallet: await this.getWalletAddress(),
      lifespan: args?.lifespan ?? DEFAULT_LIFESPAN,
      chainId: toNetworkID(args.network || this.config.network)
    }
  }

  /**
   * Builds a payload that can be sent to the WaaS API to sign a transaction.
   * It automatically signs the payload, and attaches the current wallet address.
   *
   * @param packet The action already packed into a packet
   * @returns A payload that can be sent to the WaaS API
   */
  private async buildPayload<T extends BasePacket>(packet: T): Promise<Payload<T>> {
    if (!(await this.isSignedIn())) {
      throw new Error('Not signed in')
    }

    const signerPk = await this.signer.get()
    if (!signerPk) {
      throw new Error('No signer')
    }

    // todo: use generic signer interface
    const signer = await createSigner(signerPk)
    const signature = await signPacket(signer, packet)

    return {
      version: this.VERSION,
      packet,
      signatures: [
        {
          sessionId: await this.sessionId.get() || '',
          signature
        }
      ]
    }
  }

  public async signUsingSessionKey(message: string | Uint8Array) {
    const signerPk = await this.signer.get()
    if (!signerPk) {
      throw new Error('No signer')
    }

    const signer = await createSigner(signerPk)
    return signer.signMessage(message)
  }

  public async getSignerAddress() {
    const signerPk = await this.signer.get()
    if (!signerPk) {
      throw new Error('No signer')
    }

    const signer = await createSigner(signerPk)
    return signer.getAddress()
  }

  /**
   * This method will return session id.
   *
   * @returns an id of the session
   */
  public async getSessionID(): Promise<string | undefined> {
    return this.sessionId.get()
  }

  /**
   * This method will initiate a sign-in process with the waas API. It must be performed
   * when the user wants to sign in to the app, in parallel with the authentication of the
   * application's own authentication system.
   *
   * This method begins the sign-in process, but does not complete it. The returned payload
   * must be sent to the waas API to complete the sign-in. The waas API will return a receipt
   * that must be sent to the `completeSignIn` method to complete the sign-in.
   *
   * @param proof Information about the user that can be used to prove their identity
   * @returns a session payload that **must** be sent to the waas API to complete the sign-in
   * @throws {Error} If the session is already signed in or there is a pending sign-in
   */
  async signIn(proof?: SessionPacketProof): Promise<Payload<OpenSessionPacket>> {
    const status = await this.status.get()
    if (status !== 'signed-out') {
      await this.completeSignOut()
    }

    const result = await openSession({ proof, lifespan: DEFAULT_LIFESPAN })

    await Promise.all([this.status.set('pending'), this.signer.set(result.signer.privateKey)])

    return {
      version: this.VERSION,
      packet: result.packet,

      // NOTICE: We don't sign the open session packet.
      // because the session is not yet open, so it can't be used to sign.
      signatures: []
    }
  }

  async signOut({ lifespan, sessionId }: { sessionId?: string } & ExtraArgs = {}) {
    const packet = await closeSession({
      lifespan: lifespan || DEFAULT_LIFESPAN,
      wallet: await this.getWalletAddress(),
      sessionId: sessionId || (await this.getSignerAddress())
    })

    return this.buildPayload(packet)
  }

  async completeSignOut() {
    await Promise.all([this.status.set('signed-out'), this.signer.set(undefined), this.wallet.set(undefined), this.sessionId.set(undefined)])
  }

  /**
   * This method will complete a sign-in process with the waas API. It must be performed
   * after the `signIn` method, when the waas API has returned a receipt.
   *
   * This method completes the sign-in process by validating the receipt's proof.
   * If the proof is invalid or there is no pending sign-in, it will throw an error.
   *
   * After this method is called, the wallet is ready to be used to sign transactions.
   *
   * @param receipt The receipt returned by the waas API after the `signIn` method
   * @returns The wallet address of the user that signed in
   * @throws {Error} If there is no pending sign-in or the receipt is invalid
   */
  async completeSignIn(receipt: OpenSessionResponse): Promise<string> {
    if ((receipt as any).result) {
      return this.completeSignIn((receipt as any).result)
    }

    const status = await this.status.get()
    const signerPk = await this.signer.get()

    if (receipt.code !== 'sessionOpened') {
      throw new Error('Invalid receipt')
    }

    if (status !== 'pending' || !signerPk) {
      throw new Error('No pending sign in')
    }

    console.log('receipt.data', receipt.data)

    await Promise.all([this.status.set('signed-in'), this.wallet.set(receipt.data.wallet), this.sessionId.set(receipt.data.sessionId)])

    return receipt.data.wallet
  }

  async isSignedIn() {
    const status = await this.status.get()
    return status === 'signed-in'
  }

  //
  // Signer methods
  //

  /**
   * This method can be used to sign message using waas API. It can only be used
   * after successfully signing in with the `signIn` and `completeSignIn` methods.
   *
   * The method does not sign the message. It only returns a payload
   * that must be sent to the waas API to complete the sign process.
   *
   * @param chainId The network on which the message will be signed
   * @param message  The message that will be signed
   * @return a payload that must be sent to the waas API to complete sign process
   */
  async signMessage(args: WithSimpleNetwork<SignMessageArgs> & ExtraArgs): Promise<Payload<SignMessagePacket>> {
    const packet = signMessage({
      chainId: toNetworkID(args.network || this.config.network),
      lifespan: args.lifespan ?? DEFAULT_LIFESPAN,
      wallet: await this.getWalletAddress(),
      ...args
    })

    return this.buildPayload(packet)
  }

  /**
   * This method can be used to send transactions to the waas API. It can only be used
   * after successfully signing in with the `signIn` and `completeSignIn` methods.
   *
   * The method does not send the transactions to the network. It only returns a payload
   * that must be sent to the waas API to complete the transaction.
   *
   * @param transactions The transactions to be sent
   * @param chainId The network on which the transactions will be sent
   * @returns a payload that must be sent to the waas API to complete the transaction
   */
  async sendTransaction(
    args: WithSimpleNetwork<SendTransactionsArgs> & ExtraTransactionArgs
  ): Promise<Payload<TransactionsPacket>> {
    const packet = sendTransactions(await this.commonArgs(args))
    return this.buildPayload(packet)
  }

  async sendERC20(args: WithSimpleNetwork<SendERC20Args> & ExtraTransactionArgs): Promise<Payload<TransactionsPacket>> {
    if (args.token.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC20')
    }

    const packet = sendERC20(await this.commonArgs(args))
    return this.buildPayload(packet)
  }

  async sendERC721(args: WithSimpleNetwork<SendERC721Args> & ExtraTransactionArgs): Promise<Payload<TransactionsPacket>> {
    if (args.token.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC721')
    }

    const packet = sendERC721(await this.commonArgs(args))
    return this.buildPayload(packet)
  }

  async sendERC1155(args: WithSimpleNetwork<SendERC1155Args> & ExtraTransactionArgs): Promise<Payload<TransactionsPacket>> {
    if (args.token.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC1155')
    }

    const packet = sendERC1155(await this.commonArgs(args))
    return this.buildPayload(packet)
  }

  async callContract(
    args: WithSimpleNetwork<SendDelayedEncodeArgs> & ExtraTransactionArgs
  ): Promise<Payload<TransactionsPacket>> {
    const packet = sendDelayedEncode(await this.commonArgs(args))
    return this.buildPayload(packet)
  }

  async validateSession({
    deviceMetadata,
    redirectURL
  }: {
    deviceMetadata: string
    redirectURL?: string
  }): Promise<Payload<ValidateSessionPacket>> {
    // todo: provide session id
    const packet = await validateSession({
      lifespan: DEFAULT_LIFESPAN,
      sessionId: await this.getSignerAddress(),
      deviceMetadata,
      redirectURL,
      wallet: await this.getWalletAddress()
    })

    return this.buildPayload(packet)
  }

  async getSession(): Promise<Payload<GetSessionPacket>> {
    // todo: session id
    const packet = await getSession({
      sessionId: await this.getSignerAddress(),
      wallet: await this.getWalletAddress(),
      lifespan: DEFAULT_LIFESPAN
    })

    return this.buildPayload(packet)
  }

  async finishValidateSession(salt: string, challenge: string): Promise<Payload<FinishValidateSessionPacket>> {
    // todo: session id
    const sessionId = await this.getSignerAddress()
    const wallet = await this.getWalletAddress()
    const packet = finishValidateSession(wallet, sessionId, salt, challenge, DEFAULT_LIFESPAN)
    return this.buildPayload(packet)
  }

  async batch(payloads: Payload<TransactionsPacket>[]): Promise<Payload<TransactionsPacket>> {
    const combined = combinePackets(payloads.map(p => p.packet))
    return this.buildPayload(combined)
  }
}
