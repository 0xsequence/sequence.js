import {
  closeSession,
  getSession,
  openSession,
  listSessions,
  validateSession,
  finishValidateSession, SignedIntent, signIntent, Intent,
} from './intents'
import { LocalStore, Store, StoreObj } from './store'
import { newSessionFromSessionId } from "./session";
import {
  combineTransactionIntents,
  sendERC1155,
  sendERC20,
  sendERC721,
  sendTransactions,
  SendTransactionsArgs,
  SendERC20Args,
  SendERC721Args,
  SendERC1155Args,
  // TODO: SendDelayedEncodeArgs,
  // TODO: sendDelayedEncode
} from './intents'
import { OpenSessionResponse } from './payloads/responses'
import { SignMessageArgs, signMessage } from './intents'
import { SimpleNetwork, WithSimpleNetwork, toNetworkID } from './networks'
import {
  IntentDataFinishValidateSession,
  IntentDataGetSession,
  IntentDataOpenSession,
  IntentDataSendTransaction,
  IntentDataSignMessage,
  IntentDataValidateSession
} from "./clients/intent.gen";

type status = 'pending' | 'signed-in' | 'signed-out'

const SEQUENCE_WAAS_WALLET_KEY = '@0xsequence.waas.wallet'
const SEQUENCE_WAAS_SESSION_ID_KEY = '@0xsequence.waas.session_id'
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
  private readonly wallet: StoreObj<string | undefined>

  constructor(
    public readonly config = { network: 1 } as SequenceBaseConfig,
    private readonly store: Store = new LocalStore()
  ) {
    this.status = new StoreObj(this.store, SEQUENCE_WAAS_STATUS_KEY, 'signed-out')
    this.sessionId = new StoreObj(this.store, SEQUENCE_WAAS_SESSION_ID_KEY, undefined)
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
  private async buildPayload<T>(intent: Intent<T>): Promise<SignedIntent<T>> {
    const sessionId = await this.sessionId.get()
    if (sessionId === undefined) {
      throw new Error('session not open')
    }

    const session = await newSessionFromSessionId(sessionId)
    return signIntent(session, intent)
  }

  public async signUsingSessionKey(message: string | Uint8Array) {
    const sessionId = await this.sessionId.get()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const signer = await newSessionFromSessionId(sessionId)
    return signer.sign(message)
  }

  /**
   * This method will return session id.
   *
   * @returns an id of the session
   */
  public async getSessionId(): Promise<string | undefined> {
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
  async signIn({ idToken }: { idToken: string }): Promise<SignedIntent<IntentDataOpenSession>> {
    const status = await this.status.get()
    if (status !== 'signed-out') {
      await this.completeSignOut()
    }

    const intent = await openSession({ idToken, lifespan: DEFAULT_LIFESPAN })

    await Promise.all([this.status.set('pending'), this.sessionId.set(intent.data.sessionId)])

    return this.buildPayload(intent)
  }

  async signOut({ lifespan, sessionId }: { sessionId?: string } & ExtraArgs = {}) {
    sessionId = sessionId || await this.sessionId.get()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const intent = closeSession({
      lifespan: lifespan || DEFAULT_LIFESPAN,
      sessionId: sessionId
    })

    return this.buildPayload(intent)
  }

  async signOutSession(sessionId: string) {
    const intent = closeSession({
      lifespan: DEFAULT_LIFESPAN,
      sessionId: sessionId
    })

    return this.buildPayload(intent)
  }

  async listSessions() {
    const intent = listSessions({
      lifespan: DEFAULT_LIFESPAN,
      wallet: await this.getWalletAddress(),
    })

    return this.buildPayload(intent)
  }

  async completeSignOut() {
    await Promise.all([this.status.set('signed-out'), this.wallet.set(undefined), this.sessionId.set(undefined)])
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

    if (receipt.code !== 'sessionOpened') {
      throw new Error('Invalid receipt')
    }

    if (status !== 'pending') {
      throw new Error('No pending sign in')
    }

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
  async signMessage(args: WithSimpleNetwork<SignMessageArgs> & ExtraArgs): Promise<SignedIntent<IntentDataSignMessage>> {
    const packet = signMessage({
      chainId: toNetworkID(args.network || this.config.network),
      ...args,
      lifespan: args.lifespan ?? DEFAULT_LIFESPAN,
      wallet: await this.getWalletAddress(),
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
  async sendTransaction(args: WithSimpleNetwork<SendTransactionsArgs> & ExtraArgs): Promise<SignedIntent<IntentDataSendTransaction>> {
    const intent = sendTransactions(await this.commonArgs(args))
    return this.buildPayload(intent)
  }

  async sendERC20(args: WithSimpleNetwork<SendERC20Args> & ExtraArgs): Promise<SignedIntent<IntentDataSendTransaction>> {
    if (args.tokenAddress.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC20')
    }

    const intent = sendERC20(await this.commonArgs(args))
    return this.buildPayload(intent)
  }

  async sendERC721(args: WithSimpleNetwork<SendERC721Args> & ExtraArgs): Promise<SignedIntent<IntentDataSendTransaction>> {
    if (args.tokenAddress.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC721')
    }

    const intent = sendERC721(await this.commonArgs(args))
    return this.buildPayload(intent)
  }

  async sendERC1155(args: WithSimpleNetwork<SendERC1155Args> & ExtraArgs): Promise<SignedIntent<IntentDataSendTransaction>> {
    if (args.tokenAddress.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC1155')
    }

    const intent = sendERC1155(await this.commonArgs(args))
    return this.buildPayload(intent)
  }

  /*
  TODO:
  async callContract(args: WithSimpleNetwork<SendDelayedEncodeArgs>): Promise<SignedIntent<IntentDataSendTransaction>> {
    const intent = sendDelayedEncode(await this.commonArgs(args))
    return this.buildPayload(intent)
  }
   */

  async validateSession({ deviceMetadata }: { deviceMetadata: string }): Promise<SignedIntent<IntentDataValidateSession>> {
    const sessionId = await this.sessionId.get()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const intent = await validateSession({
      lifespan: DEFAULT_LIFESPAN,
      sessionId: sessionId,
      deviceMetadata,
      wallet: await this.getWalletAddress()
    })

    return this.buildPayload(intent)
  }

  async getSession(): Promise<SignedIntent<IntentDataGetSession>> {
    const sessionId = await this.sessionId.get()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const intent = getSession({
      sessionId,
      wallet: await this.getWalletAddress(),
      lifespan: DEFAULT_LIFESPAN
    })

    return this.buildPayload(intent)
  }

  async finishValidateSession(salt: string, challenge: string): Promise<SignedIntent<IntentDataFinishValidateSession>> {
    const sessionId = await this.sessionId.get()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const wallet = await this.getWalletAddress()
    const intent = finishValidateSession({
      sessionId,
      wallet,
      lifespan: DEFAULT_LIFESPAN,
      salt,
      challenge,
    })
    return this.buildPayload(intent)
  }

  async batch(intents: Intent<IntentDataSendTransaction>[]): Promise<SignedIntent<IntentDataSendTransaction>> {
    const combined = combineTransactionIntents(intents)
    return this.buildPayload(combined)
  }
}
