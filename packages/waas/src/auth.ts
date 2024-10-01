import { Observer, SequenceWaaSBase } from './base'
import {
  Account,
  IdentityType,
  IntentDataOpenSession,
  IntentDataSendTransaction,
  IntentResponseIdToken
} from './clients/intent.gen'
import { newSessionFromSessionId } from './session'
import { LocalStore, Store, StoreObj } from './store'
import {
  GetTransactionReceiptArgs,
  SendDelayedEncodeArgs,
  SendERC1155Args,
  SendERC20Args,
  SendERC721Args,
  SendTransactionsArgs,
  SignedIntent,
  SignMessageArgs
} from './intents'
import {
  FeeOptionsResponse,
  isCloseSessionResponse,
  isFeeOptionsResponse,
  isFinishValidateSessionResponse,
  isGetIdTokenResponse,
  isGetSessionResponse,
  isInitiateAuthResponse,
  isIntentTimeError,
  isLinkAccountResponse,
  isListAccountsResponse,
  isMaySentTransactionResponse,
  isSessionAuthProofResponse,
  isSignedMessageResponse,
  isTimedOutTransactionResponse,
  isValidationRequiredResponse,
  MaySentTransactionResponse,
  SignedMessageResponse
} from './intents/responses'
import { WaasAuthenticator, AnswerIncorrectError, Chain, EmailAlreadyInUseError, Session } from './clients/authenticator.gen'
import { SimpleNetwork, WithSimpleNetwork } from './networks'
import { EmailAuth } from './email'
import { ethers } from 'ethers'
import { getDefaultSubtleCryptoBackend, SubtleCryptoBackend } from './subtle-crypto'
import { getDefaultSecureStoreBackend, SecureStoreBackend } from './secure-store'
import { Challenge, EmailChallenge, GuestChallenge, IdTokenChallenge, PlayFabChallenge, StytchChallenge } from './challenge'
import { jwtDecode } from 'jwt-decode'

export type Sessions = (Session & { isThis: boolean })[]
export type { Account }
export { IdentityType }

export type SequenceConfig = {
  projectAccessKey: string
  waasConfigKey: string
  network?: SimpleNetwork
}

export type ExtendedSequenceConfig = {
  rpcServer: string
  emailRegion?: string
}

export type WaaSConfigKey = {
  projectId: number
  emailClientId?: string
}

export type GuestIdentity = { guest: true }
export type IdTokenIdentity = { idToken: string }
export type EmailIdentity = { email: string }
export type PlayFabIdentity = {
  playFabTitleId: string
  playFabSessionTicket: string
}

export type Identity = IdTokenIdentity | EmailIdentity | PlayFabIdentity | GuestIdentity

export type SignInResponse = {
  sessionId: string
  wallet: string
  email?: string
}

function encodeHex(data: string | Uint8Array) {
  return (
    '0x' +
    Array.from(typeof data === 'string' ? new TextEncoder().encode(data) : data, byte => byte.toString(16).padStart(2, '0')).join(
      ''
    )
  )
}

function decodeHex(hex: string) {
  return new Uint8Array(
    hex
      .substring(2)
      .match(/.{1,2}/g)!
      .map(byte => parseInt(byte, 16))
  )
}

export type ValidationArgs = {
  onValidationRequired?: () => boolean
}

export type CommonAuthArgs = {
  validation?: ValidationArgs
  identifier?: string
}

export type Network = Chain

export type NetworkList = Network[]

export type EmailConflictInfo = {
  type: IdentityType
  email: string
  issuer: string
}

export function parseSequenceWaaSConfigKey<T>(key: string): Partial<T> {
  return JSON.parse(atob(key))
}

export function defaultArgsOrFail(
  config: SequenceConfig & Partial<ExtendedSequenceConfig>
): Required<SequenceConfig> & Required<WaaSConfigKey> & ExtendedSequenceConfig {
  const key = (config as any).waasConfigKey
  const keyOverrides = key ? parseSequenceWaaSConfigKey<SequenceConfig & WaaSConfigKey & ExtendedSequenceConfig>(key) : {}
  const preconfig = { ...config, ...keyOverrides }

  if (preconfig.network === undefined) {
    preconfig.network = 1
  }

  if (preconfig.projectId === undefined) {
    throw new Error('Missing project id')
  }

  if (preconfig.projectAccessKey === undefined) {
    throw new Error('Missing access key')
  }

  return preconfig as Required<SequenceConfig> & Required<WaaSConfigKey> & ExtendedSequenceConfig
}

export class SequenceWaaS {
  private waas: SequenceWaaSBase
  private client: WaasAuthenticator

  private validationRequiredCallback: (() => void)[] = []
  private emailConflictCallback: ((info: EmailConflictInfo, forceCreate: () => Promise<void>) => Promise<void>)[] = []
  private emailAuthCodeRequiredCallback: ((respondWithCode: (code: string) => Promise<void>) => Promise<void>)[] = []
  private validationRequiredSalt: string

  public readonly config: Required<SequenceConfig> & Required<WaaSConfigKey> & ExtendedSequenceConfig

  private readonly deviceName: StoreObj<string | undefined>

  private emailClient: EmailAuth | undefined

  // The last Date header value returned by the server, used for users with desynchronised clocks
  private lastDate: Date | undefined

  constructor(
    config: SequenceConfig & Partial<ExtendedSequenceConfig>,
    private readonly store: Store = new LocalStore(),
    private readonly cryptoBackend: SubtleCryptoBackend | null = getDefaultSubtleCryptoBackend(),
    private readonly secureStoreBackend: SecureStoreBackend | null = getDefaultSecureStoreBackend()
  ) {
    this.config = defaultArgsOrFail(config)
    this.waas = new SequenceWaaSBase({ network: 1, ...config }, this.store, this.cryptoBackend, this.secureStoreBackend)
    this.client = new WaasAuthenticator(this.config.rpcServer, this.fetch.bind(this))
    this.deviceName = new StoreObj(this.store, '@0xsequence.waas.auth.deviceName', undefined)
  }

  public get email() {
    if (this.emailClient) {
      return this.emailClient
    }

    if (!this.config.emailRegion) {
      throw new Error('Missing emailRegion')
    }

    if (!this.config.emailClientId) {
      throw new Error('Missing emailClientId')
    }

    this.emailClient = new EmailAuth(this.config.emailRegion, this.config.emailClientId)
    return this.emailClient
  }

  async onValidationRequired(callback: () => void) {
    this.validationRequiredCallback.push(callback)
    return () => {
      this.validationRequiredCallback = this.validationRequiredCallback.filter(c => c !== callback)
    }
  }

  onEmailConflict(callback: (info: EmailConflictInfo, forceCreate: () => Promise<void>) => Promise<void>) {
    this.emailConflictCallback.push(callback)
    return () => {
      this.emailConflictCallback = this.emailConflictCallback.filter(c => c !== callback)
    }
  }

  onEmailAuthCodeRequired(callback: (respondWithCode: (code: string) => Promise<void>) => Promise<void>) {
    this.emailAuthCodeRequiredCallback.push(callback)
    return () => {
      this.emailAuthCodeRequiredCallback = this.emailAuthCodeRequiredCallback.filter(c => c !== callback)
    }
  }

  private async handleValidationRequired({ onValidationRequired }: ValidationArgs = {}): Promise<boolean> {
    const proceed = onValidationRequired ? onValidationRequired() : true
    if (!proceed) {
      return false
    }

    const intent = await this.waas.validateSession({
      deviceMetadata: (await this.deviceName.get()) ?? 'Unknown device'
    })

    const sendIntent = await this.sendIntent(intent)
    this.validationRequiredSalt = sendIntent.data.salt

    for (const callback of this.validationRequiredCallback) {
      callback()
    }

    return this.waitForSessionValid()
  }

  private headers() {
    return {
      'X-Access-Key': this.config.projectAccessKey
    }
  }

  private async sendIntent(intent: SignedIntent<any>) {
    const sessionId = await this.waas.getSessionId()
    if (!sessionId) {
      throw new Error('session not open')
    }

    try {
      const res = await this.client.sendIntent({ intent: intent }, this.headers())
      return res.response
    } catch (e) {
      if (isIntentTimeError(e) && this.lastDate) {
        const newIntent = await this.waas.updateIntentTime(intent, this.lastDate)
        const res = await this.client.sendIntent({ intent: newIntent }, this.headers())
        return res.response
      }
      throw e
    }
  }

  async isSignedIn() {
    return this.waas.isSignedIn()
  }

  signIn(creds: Identity, sessionName: string): Promise<SignInResponse> {
    const isEmailAuth = 'email' in creds
    if (isEmailAuth && this.emailAuthCodeRequiredCallback.length == 0) {
      return Promise.reject('Missing emailAuthCodeRequired callback')
    }

    return new Promise<SignInResponse>(async (resolve, reject) => {
      let challenge: Challenge
      try {
        challenge = await this.initAuth(creds)
      } catch (e) {
        return reject(e)
      }

      const respondToChallenge = async (answer: string) => {
        try {
          const res = await this.completeAuth(challenge.withAnswer(answer), { sessionName })
          resolve(res)
        } catch (e) {
          if (e instanceof AnswerIncorrectError) {
            // This will NOT resolve NOR reject the top-level promise returned from signIn, it'll keep being pending
            // It allows the caller to retry calling the respondToChallenge callback
            throw e
          } else if (e instanceof EmailAlreadyInUseError) {
            const forceCreate = async () => {
              try {
                const res = await this.completeAuth(challenge.withAnswer(answer), { sessionName, forceCreateAccount: true })
                resolve(res)
              } catch (e) {
                reject(e)
              }
            }
            const info: EmailConflictInfo = {
              type: IdentityType.None,
              email: '',
              issuer: ''
            }
            if (e.cause) {
              const parts = e.cause.split('|')
              if (parts.length >= 2) {
                info.type = parts[0] as IdentityType
                info.email = parts[1]
              }
              if (parts.length >= 3) {
                info.issuer = parts[2]
              }
            }
            for (const callback of this.emailConflictCallback) {
              callback(info, forceCreate)
            }
          } else {
            reject(e)
          }
        }
      }

      if (isEmailAuth) {
        for (const callback of this.emailAuthCodeRequiredCallback) {
          callback(respondToChallenge)
        }
      } else {
        respondToChallenge('')
      }
    })
  }

  async initAuth(identity: Identity): Promise<Challenge> {
    if ('guest' in identity && identity.guest) {
      return this.initGuestAuth()
    } else if ('idToken' in identity) {
      return this.initIdTokenAuth(identity.idToken)
    } else if ('email' in identity) {
      return this.initEmailAuth(identity.email)
    } else if ('playFabTitleId' in identity) {
      return this.initPlayFabAuth(identity.playFabTitleId, identity.playFabSessionTicket)
    }

    throw new Error('invalid identity')
  }

  private async initGuestAuth() {
    const sessionId = await this.waas.getSessionId()
    const intent = await this.waas.initiateGuestAuth()
    const res = await this.sendIntent(intent)

    if (!isInitiateAuthResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`)
    }
    return new GuestChallenge(sessionId, res.data.challenge!)
  }

  private async initIdTokenAuth(idToken: string) {
    const decoded = jwtDecode(idToken)
    const isStytch = decoded.iss?.startsWith('stytch.com/') || false
    const intent = isStytch
      ? await this.waas.initiateStytchAuth(idToken, decoded.exp)
      : await this.waas.initiateIdTokenAuth(idToken, decoded.exp)
    const res = await this.sendIntent(intent)

    if (!isInitiateAuthResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`)
    }
    return isStytch ? new StytchChallenge(idToken) : new IdTokenChallenge(idToken)
  }

  private async initEmailAuth(email: string) {
    const sessionId = await this.waas.getSessionId()
    const intent = await this.waas.initiateEmailAuth(email)
    const res = await this.sendIntent(intent)

    if (!isInitiateAuthResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`)
    }
    return new EmailChallenge(email, sessionId, res.data.challenge!)
  }

  private async initPlayFabAuth(titleId: string, sessionTicket: string) {
    const intent = await this.waas.initiatePlayFabAuth(titleId, sessionTicket)
    const res = await this.sendIntent(intent)

    if (!isInitiateAuthResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`)
    }
    return new PlayFabChallenge(titleId, sessionTicket)
  }

  async completeAuth(
    challenge: Challenge,
    opts?: { sessionName?: string; forceCreateAccount?: boolean }
  ): Promise<SignInResponse> {
    if (!opts) {
      opts = {}
    }
    if (!opts.sessionName) {
      opts.sessionName = 'session name'
    }

    const intent = await this.waas.completeAuth(challenge.getIntentParams(), { forceCreateAccount: opts.forceCreateAccount })
    try {
      const res = await this.registerSession(intent, opts.sessionName)

      await this.waas.completeSignIn({
        code: 'sessionOpened',
        data: {
          sessionId: res.session.id,
          wallet: res.response.data.wallet
        }
      })

      return {
        sessionId: res.session.id,
        wallet: res.response.data.wallet,
        email: res.session.identity.email
      }
    } catch (e) {
      if (!(e instanceof EmailAlreadyInUseError) && !(e instanceof AnswerIncorrectError)) {
        await this.waas.completeSignOut()
      }
      throw e
    }
  }

  async registerSession(intent: SignedIntent<IntentDataOpenSession>, name: string) {
    try {
      const res = await this.client.registerSession({ intent, friendlyName: name }, this.headers())
      return res
    } catch (e) {
      if (isIntentTimeError(e) && this.lastDate) {
        const newIntent = await this.waas.updateIntentTime(intent, this.lastDate)
        return await this.client.registerSession({ intent: newIntent, friendlyName: name }, this.headers())
      }
      throw e
    }
  }

  private async refreshSession() {
    throw new Error('Not implemented')
  }

  async getSessionId() {
    return this.waas.getSessionId()
  }

  async getSessionHash() {
    const sessionId = (await this.waas.getSessionId()).toLowerCase()
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sessionId))
  }

  async dropSession({ sessionId, strict }: { sessionId?: string; strict?: boolean } = {}) {
    const thisSessionId = await this.waas.getSessionId()
    if (!thisSessionId) {
      throw new Error('session not open')
    }

    const closeSessionId = sessionId || thisSessionId

    try {
      const intent = await this.waas.signOutSession(closeSessionId)
      const result = await this.sendIntent(intent)

      if (!isCloseSessionResponse(result)) {
        throw new Error(`Invalid response: ${JSON.stringify(result)}`)
      }
    } catch (e) {
      if (strict) {
        throw e
      }

      console.error(e)
    }

    if (closeSessionId === thisSessionId) {
      if (!this.secureStoreBackend) {
        throw new Error('No secure store available')
      }

      const session = await newSessionFromSessionId(thisSessionId, this.cryptoBackend, this.secureStoreBackend)
      session.clear()
      await this.waas.completeSignOut()
      await this.deviceName.set(undefined)
    }
  }

  async listSessions(): Promise<Sessions> {
    const sessionId = await this.waas.getSessionId()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const intent = await this.waas.listSessions()
    const res = await this.sendIntent(intent)

    return (res.data as Session[]).map(session => ({
      ...session,
      isThis: session.id === sessionId
    }))
  }

  // WaaS specific methods
  async getAddress() {
    return this.waas.getAddress()
  }

  async validateSession(args?: ValidationArgs) {
    if (await this.isSessionValid()) {
      return true
    }

    return this.handleValidationRequired(args)
  }

  async finishValidateSession(challenge: string): Promise<boolean> {
    const intent = await this.waas.finishValidateSession(this.validationRequiredSalt, challenge)
    const result = await this.sendIntent(intent)

    if (!isFinishValidateSessionResponse(result)) {
      throw new Error(`Invalid response: ${JSON.stringify(result)}`)
    }

    this.validationRequiredSalt = ''
    return result.data.isValid
  }

  async isSessionValid(): Promise<boolean> {
    const intent = await this.waas.getSession()
    const result = await this.sendIntent(intent)

    if (!isGetSessionResponse(result)) {
      throw new Error(`Invalid response: ${JSON.stringify(result)}`)
    }

    return result.data.validated
  }

  async waitForSessionValid(timeout: number = 600000, pollRate: number = 2000) {
    const start = Date.now()

    while (Date.now() - start < timeout) {
      if (await this.isSessionValid()) {
        return true
      }

      await new Promise(resolve => setTimeout(resolve, pollRate))
    }

    return false
  }

  async sessionAuthProof({ nonce, network, validation }: { nonce?: string; network?: string; validation?: ValidationArgs }) {
    const intent = await this.waas.sessionAuthProof({ nonce, network })
    return await this.trySendIntent({ validation }, intent, isSessionAuthProofResponse)
  }

  async listAccounts() {
    const intent = await this.waas.listAccounts()
    const res = await this.sendIntent(intent)

    if (!isListAccountsResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`)
    }

    return res.data
  }

  async linkAccount(challenge: Challenge) {
    const intent = await this.waas.linkAccount(challenge.getIntentParams())
    const res = await this.sendIntent(intent)

    if (!isLinkAccountResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`)
    }

    return res.data
  }

  async removeAccount(accountId: string) {
    const intent = await this.waas.removeAccount({ accountId })
    await this.sendIntent(intent)
  }

  async getIdToken(args?: { nonce?: string }): Promise<IntentResponseIdToken> {
    const intent = await this.waas.getIdToken({ nonce: args?.nonce })
    const res = await this.sendIntent(intent)

    if (!isGetIdTokenResponse(res)) {
      throw new Error(`Invalid response: ${JSON.stringify(res)}`)
    }

    return res.data
  }

  async useIdentifier<T extends CommonAuthArgs>(args: T): Promise<T & { identifier: string }> {
    if (args.identifier) {
      return args as T & { identifier: string }
    }

    // Generate a new identifier
    const identifier = `ts-sdk-${Date.now()}-${await this.waas.getSessionId()}`
    return { ...args, identifier } as T & { identifier: string }
  }

  private async trySendIntent<T>(
    args: CommonAuthArgs,
    intent: SignedIntent<any>,
    isExpectedResponse: (response: any) => response is T
  ): Promise<T> {
    const response = await this.sendIntent(intent)

    if (isExpectedResponse(response)) {
      return response
    }

    if (isValidationRequiredResponse(response)) {
      const proceed = await this.handleValidationRequired(args.validation)

      if (proceed) {
        const response2 = await this.sendIntent(intent)
        if (isExpectedResponse(response2)) {
          return response2
        }
      }
    }

    throw new Error(JSON.stringify(response))
  }

  async signMessage(args: WithSimpleNetwork<SignMessageArgs> & CommonAuthArgs): Promise<SignedMessageResponse> {
    const intent = await this.waas.signMessage(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isSignedMessageResponse)
  }

  private async trySendTransactionIntent(
    intent: SignedIntent<IntentDataSendTransaction>,
    args: CommonAuthArgs
  ): Promise<MaySentTransactionResponse> {
    let result = await this.trySendIntent(args, intent, isMaySentTransactionResponse)

    while (isTimedOutTransactionResponse(result)) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const receiptArgs: WithSimpleNetwork<GetTransactionReceiptArgs> & CommonAuthArgs = {
        metaTxHash: result.data.metaTxHash,
        network: intent.data.network,
        identifier: intent.data.identifier,
        validation: args.validation
      }
      const receiptIntent = await this.waas.getTransactionReceipt(await this.useIdentifier(receiptArgs))
      result = await this.trySendIntent(receiptArgs, receiptIntent, isMaySentTransactionResponse)
    }

    return result
  }

  async sendTransaction(args: WithSimpleNetwork<SendTransactionsArgs> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendTransaction(await this.useIdentifier(args))
    return this.trySendTransactionIntent(intent, args)
  }

  async sendERC20(args: WithSimpleNetwork<SendERC20Args> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendERC20(await this.useIdentifier(args))
    return this.trySendTransactionIntent(intent, args)
  }

  async sendERC721(args: WithSimpleNetwork<SendERC721Args> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendERC721(await this.useIdentifier(args))
    return this.trySendTransactionIntent(intent, args)
  }

  async sendERC1155(args: WithSimpleNetwork<SendERC1155Args> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendERC1155(await this.useIdentifier(args))
    return this.trySendTransactionIntent(intent, args)
  }

  async callContract(args: WithSimpleNetwork<SendDelayedEncodeArgs> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.callContract(await this.useIdentifier(args))
    return this.trySendTransactionIntent(intent, args)
  }

  async feeOptions(args: WithSimpleNetwork<SendTransactionsArgs> & CommonAuthArgs): Promise<FeeOptionsResponse> {
    const intent = await this.waas.feeOptions(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isFeeOptionsResponse)
  }

  async networkList(): Promise<NetworkList> {
    const networks: NetworkList = []
    const chainList = await this.client.chainList({
      'X-Access-Key': this.config.projectAccessKey
    })

    for (const chain of chainList.chains) {
      networks.push({
        id: chain.id,
        name: chain.name,
        isEnabled: chain.isEnabled
      })
    }
    return networks
  }

  onSessionStateChanged(callback: Observer<string>) {
    return this.waas.onSessionStateChanged(callback)
  }

  // Special version of fetch that keeps track of the last seen Date header
  async fetch(input: RequestInfo, init?: RequestInit) {
    const res = await globalThis.fetch(input, init)
    const headerValue = res.headers.get('date')
    if (headerValue) {
      this.lastDate = new Date(headerValue)
    }
    return res
  }
}
