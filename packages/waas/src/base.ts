import {
  changeIntentTime,
  closeSession,
  combineTransactionIntents,
  feeOptions,
  finishValidateSession,
  getIdToken,
  getSession,
  getTransactionReceipt,
  GetTransactionReceiptArgs,
  initiateAuth,
  Intent,
  listSessions,
  openSession,
  OpenSessionArgs,
  sendContractCall,
  SendContractCallArgs,
  sendERC1155,
  SendERC1155Args,
  sendERC20,
  SendERC20Args,
  sendERC721,
  SendERC721Args,
  sendTransactions,
  SendTransactionsArgs,
  sessionAuthProof,
  SignedIntent,
  signIntent,
  signMessage,
  SignMessageArgs,
  signTypedData,
  SignTypedDataArgs,
  validateSession
} from './intents'
import { LocalStore, Store, StoreObj } from './store'
import { newSession, newSessionFromSessionId } from './session'
import { OpenSessionResponse } from './intents/responses'
import { federateAccount, listAccounts, removeAccount } from './intents/accounts'
import { SimpleNetwork, toNetworkID, WithSimpleNetwork } from './networks'
import {
  IdentityType,
  IntentDataFederateAccount,
  IntentDataFeeOptions,
  IntentDataFinishValidateSession,
  IntentDataGetSession,
  IntentDataGetTransactionReceipt,
  IntentDataInitiateAuth,
  IntentDataListAccounts,
  IntentDataOpenSession,
  IntentDataSendTransaction,
  IntentDataSignMessage,
  IntentDataSignTypedData,
  IntentDataValidateSession
} from './clients/intent.gen'
import { getDefaultSubtleCryptoBackend, SubtleCryptoBackend } from './subtle-crypto'
import { getDefaultSecureStoreBackend, SecureStoreBackend } from './secure-store'
import { ethers } from 'ethers'
import { ChallengeIntentParams } from './challenge'
import { NoPrivateKeyError } from './errors'

type Status = 'pending' | 'signed-in' | 'signed-out'

const SEQUENCE_WAAS_WALLET_KEY = '@0xsequence.waas.wallet'
const SEQUENCE_WAAS_SESSION_ID_KEY = '@0xsequence.waas.session_id'
const SEQUENCE_WAAS_STATUS_KEY = '@0xsequence.waas.status'

// 5 minutes of default lifespan
const DEFAULT_LIFESPAN = 5 * 60

export type SessionAuthProofArgs = {
  nonce?: string
}

export type ExtraArgs = {
  lifespan?: number
}

export type ExtraTransactionArgs = ExtraArgs & {
  identifier: string
}

export type SequenceBaseConfig = {
  network: SimpleNetwork
}

export type Observer<T> = (value: T | null) => any

export class SequenceWaaSBase {
  private readonly status: StoreObj<Status>
  private readonly sessionId: StoreObj<string | undefined>
  private readonly wallet: StoreObj<string | undefined>

  private sessionObservers: Observer<string>[] = []

  constructor(
    public readonly config = { network: 1 } as SequenceBaseConfig,
    private readonly store: Store = new LocalStore(),
    private readonly cryptoBackend: SubtleCryptoBackend | null = getDefaultSubtleCryptoBackend(),
    private readonly secureStoreBackend: SecureStoreBackend | null = getDefaultSecureStoreBackend()
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
  private async signIntent<T>(intent: Intent<T>): Promise<SignedIntent<T>> {
    const sessionId = await this.getSessionId()
    if (sessionId === undefined) {
      throw new Error('session not open')
    }

    try {
      const session = await newSessionFromSessionId(sessionId, this.cryptoBackend, this.secureStoreBackend)
      return signIntent(session, intent)
    } catch (error) {
      if (error instanceof NoPrivateKeyError) {
        await this.completeSignOut()
        throw new Error('No private key found, logging out')
      }
      throw error
    }
  }

  public async signUsingSessionKey(message: string | Uint8Array) {
    const sessionId = await this.getSessionId()
    if (!sessionId) {
      throw new Error('session not open')
    }

    try {
      const signer = await newSessionFromSessionId(sessionId, this.cryptoBackend, this.secureStoreBackend)
      return signer.sign(message)
    } catch (error) {
      if (error instanceof NoPrivateKeyError) {
        await this.completeSignOut()
        throw new Error('No private key found, logging out')
      }
      throw error
    }
  }

  private gettingSessionIdPromise: Promise<string> | undefined

  /**
   * This method will return session id.
   *
   * @returns an id of the session
   */
  public async getSessionId(): Promise<string> {
    if (this.gettingSessionIdPromise) {
      return this.gettingSessionIdPromise
    }

    const promiseGenerator = async () => {
      let sessionId = await this.sessionId.get()
      if (!sessionId) {
        const session = await newSession(this.cryptoBackend, this.secureStoreBackend)
        sessionId = await session.sessionId()
        await this.sessionId.set(sessionId)
        this.signalObservers(this.sessionObservers, sessionId)
      }
      this.gettingSessionIdPromise = undefined
      return sessionId
    }

    this.gettingSessionIdPromise = promiseGenerator()
    return this.gettingSessionIdPromise
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
   * @param idToken Information about the user that can be used to prove their identity
   * @returns a session payload that **must** be sent to the waas API to complete the sign-in
   * @throws {Error} If the session is already signed in or there is a pending sign-in
   */
  async signInWithIdToken(idToken: string): Promise<SignedIntent<IntentDataOpenSession>> {
    const status = await this.status.get()
    if (status !== 'signed-out') {
      await this.completeSignOut()
      throw new Error('you are already signed in') // TODO change this awful msg
    }

    const sessionId = await this.getSessionId()
    const intent = await openSession({
      sessionId,
      identityType: IdentityType.None,
      idToken,
      lifespan: DEFAULT_LIFESPAN
    })

    await this.status.set('pending')

    return this.signIntent(intent)
  }

  async initiateGuestAuth(): Promise<SignedIntent<IntentDataInitiateAuth>> {
    const sessionId = await this.getSessionId()
    const intent = await initiateAuth({
      sessionId,
      identityType: IdentityType.Guest,
      verifier: sessionId,
      lifespan: DEFAULT_LIFESPAN
    })

    return this.signIntent(intent)
  }

  async initiateEmailAuth(email: string): Promise<SignedIntent<IntentDataInitiateAuth>> {
    const sessionId = await this.getSessionId()
    const intent = await initiateAuth({
      sessionId,
      identityType: IdentityType.Email,
      verifier: `${email};${sessionId}`,
      lifespan: DEFAULT_LIFESPAN
    })

    return this.signIntent(intent)
  }

  async initiateIdTokenAuth(idToken: string, exp?: number): Promise<SignedIntent<IntentDataInitiateAuth>> {
    const sessionId = await this.getSessionId()
    const idTokenHash = ethers.id(idToken)
    const intent = await initiateAuth({
      sessionId,
      identityType: IdentityType.OIDC,
      verifier: `${idTokenHash};${exp}`,
      lifespan: DEFAULT_LIFESPAN
    })

    return this.signIntent(intent)
  }

  async initiateStytchAuth(idToken: string, exp?: number): Promise<SignedIntent<IntentDataInitiateAuth>> {
    const sessionId = await this.getSessionId()
    const idTokenHash = ethers.id(idToken)
    const intent = await initiateAuth({
      sessionId,
      identityType: IdentityType.Stytch,
      verifier: `${idTokenHash};${exp}`,
      lifespan: DEFAULT_LIFESPAN
    })

    return this.signIntent(intent)
  }

  async initiatePlayFabAuth(titleId: string, sessionTicket: string): Promise<SignedIntent<IntentDataInitiateAuth>> {
    const sessionId = await this.getSessionId()
    const ticketHash = ethers.id(sessionTicket)
    const intent = await initiateAuth({
      sessionId,
      identityType: IdentityType.PlayFab,
      verifier: `${titleId}|${ticketHash}`,
      lifespan: DEFAULT_LIFESPAN
    })

    return this.signIntent(intent)
  }

  async initiateXAuth(accessToken: string): Promise<SignedIntent<IntentDataInitiateAuth>> {
    const sessionId = await this.getSessionId()
    const accessTokenHash = ethers.id(accessToken)
    const intent = await initiateAuth({
      sessionId,
      identityType: IdentityType.Twitter,
      verifier: accessTokenHash,
      lifespan: DEFAULT_LIFESPAN
    })

    return this.signIntent(intent)
  }

  async completeAuth(params: ChallengeIntentParams, optParams: Partial<OpenSessionArgs>) {
    const sessionId = await this.getSessionId()
    const intent = await openSession({
      ...optParams,
      sessionId,
      lifespan: DEFAULT_LIFESPAN,
      ...params
    })

    await this.status.set('pending')

    return this.signIntent(intent)
  }

  onSessionStateChanged(callback: Observer<string>): () => void {
    this.sessionObservers.push(callback)
    return () => {
      this.sessionObservers = this.sessionObservers.filter(o => o != callback)
    }
  }

  async signOut({ lifespan, sessionId }: { sessionId?: string } & ExtraArgs = {}) {
    sessionId = sessionId || (await this.sessionId.get())
    if (!sessionId) {
      throw new Error('session not open')
    }

    const intent = closeSession({
      lifespan: lifespan || DEFAULT_LIFESPAN,
      sessionId: sessionId
    })

    return this.signIntent(intent)
  }

  async signOutSession(sessionId: string) {
    const intent = closeSession({
      lifespan: DEFAULT_LIFESPAN,
      sessionId: sessionId
    })

    return this.signIntent(intent)
  }

  async listSessions() {
    const intent = listSessions({
      lifespan: DEFAULT_LIFESPAN,
      wallet: await this.getWalletAddress()
    })

    return this.signIntent(intent)
  }

  async completeSignOut() {
    await Promise.all([this.status.set('signed-out'), this.wallet.set(undefined), this.sessionId.set(undefined)])
    this.signalObservers(this.sessionObservers, null)
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

    await Promise.all([this.status.set('signed-in'), this.wallet.set(receipt.data.wallet)])

    return receipt.data.wallet
  }

  async isSignedIn() {
    const status = await this.status.get()
    return status === 'signed-in'
  }

  async sessionAuthProof(args: WithSimpleNetwork<SessionAuthProofArgs> & ExtraArgs) {
    const packet = sessionAuthProof({
      lifespan: args.lifespan ?? DEFAULT_LIFESPAN,
      network: toNetworkID(args.network || this.config.network).toString(),
      wallet: await this.getWalletAddress(),
      nonce: args.nonce
    })
    return this.signIntent(packet)
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
      wallet: await this.getWalletAddress()
    })

    return this.signIntent(packet)
  }

  /**
   * This method can be used to sign typed data using waas API. It can only be used
   * after successfully signing in with the `signIn` and `completeSignIn` methods.
   *
   * The method does not sign the typed data. It only returns a payload
   * that must be sent to the waas API to complete the sign process.
   *
   * @param chainId The network on which the typed data will be signed
   * @param typedData  The typed data that will be signed
   * @return a payload that must be sent to the waas API to complete sign process
   */
  async signTypedData(args: WithSimpleNetwork<SignTypedDataArgs> & ExtraArgs): Promise<SignedIntent<IntentDataSignTypedData>> {
    const packet = signTypedData({
      chainId: toNetworkID(args.network || this.config.network),
      ...args,
      lifespan: args.lifespan ?? DEFAULT_LIFESPAN,
      wallet: await this.getWalletAddress()
    })

    return this.signIntent(packet)
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
  ): Promise<SignedIntent<IntentDataSendTransaction>> {
    const intent = sendTransactions(await this.commonArgs(args))
    return this.signIntent(intent)
  }

  async getTransactionReceipt(
    args: WithSimpleNetwork<GetTransactionReceiptArgs> & ExtraTransactionArgs
  ): Promise<SignedIntent<IntentDataGetTransactionReceipt>> {
    const intent = getTransactionReceipt(await this.commonArgs(args))
    return this.signIntent(intent)
  }

  async sendERC20(
    args: WithSimpleNetwork<SendERC20Args> & ExtraTransactionArgs
  ): Promise<SignedIntent<IntentDataSendTransaction>> {
    if (args.token.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC20')
    }

    const intent = sendERC20(await this.commonArgs(args))
    return this.signIntent(intent)
  }

  async sendERC721(
    args: WithSimpleNetwork<SendERC721Args> & ExtraTransactionArgs
  ): Promise<SignedIntent<IntentDataSendTransaction>> {
    if (args.token.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC721')
    }

    const intent = sendERC721(await this.commonArgs(args))
    return this.signIntent(intent)
  }

  async sendERC1155(
    args: WithSimpleNetwork<SendERC1155Args> & ExtraTransactionArgs
  ): Promise<SignedIntent<IntentDataSendTransaction>> {
    if (args.token.toLowerCase() === args.to.toLowerCase()) {
      throw new Error('Cannot burn tokens using sendERC1155')
    }

    const intent = sendERC1155(await this.commonArgs(args))
    return this.signIntent(intent)
  }

  async callContract(
    args: WithSimpleNetwork<SendContractCallArgs> & ExtraTransactionArgs
  ): Promise<SignedIntent<IntentDataSendTransaction>> {
    const intent = sendContractCall(await this.commonArgs(args))
    return this.signIntent(intent)
  }

  async feeOptions(
    args: WithSimpleNetwork<SendTransactionsArgs> & ExtraTransactionArgs
  ): Promise<SignedIntent<IntentDataFeeOptions>> {
    const intent = feeOptions(await this.commonArgs(args))
    return this.signIntent(intent)
  }

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

    return this.signIntent(intent)
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

    return this.signIntent(intent)
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
      challenge
    })
    return this.signIntent(intent)
  }

  async listAccounts(): Promise<SignedIntent<IntentDataListAccounts>> {
    const intent = listAccounts({
      wallet: await this.getWalletAddress(),
      lifespan: DEFAULT_LIFESPAN
    })
    return this.signIntent(intent)
  }

  async linkAccount(params: ChallengeIntentParams): Promise<SignedIntent<IntentDataFederateAccount>> {
    const sessionId = await this.sessionId.get()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const intent = federateAccount({
      wallet: await this.getWalletAddress(),
      lifespan: DEFAULT_LIFESPAN,
      sessionId,
      ...params
    })
    return this.signIntent(intent)
  }

  async removeAccount({ accountId }: { accountId: string }) {
    const intent = removeAccount({
      wallet: await this.getWalletAddress(),
      lifespan: DEFAULT_LIFESPAN,
      accountId
    })
    return this.signIntent(intent)
  }

  async getIdToken({ nonce }: { nonce?: string }) {
    const sessionId = await this.sessionId.get()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const intent = getIdToken({
      wallet: await this.getWalletAddress(),
      lifespan: DEFAULT_LIFESPAN,
      sessionId,
      nonce
    })
    return this.signIntent(intent)
  }

  async batch(intents: Intent<IntentDataSendTransaction>[]): Promise<SignedIntent<IntentDataSendTransaction>> {
    const combined = combineTransactionIntents(intents)
    return this.signIntent(combined)
  }

  private signalObservers<T>(observers: Observer<T>[], value: T | null) {
    observers.forEach(observer => observer(value))
  }

  async updateIntentTime<T>(intent: SignedIntent<T>, time: Date): Promise<SignedIntent<T>> {
    const newIntent = changeIntentTime(intent, time)
    return this.signIntent(newIntent)
  }
}
