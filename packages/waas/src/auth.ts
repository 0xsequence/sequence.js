import { Observer, SequenceWaaSBase } from './base'
import { IntentDataSendTransaction } from './clients/intent.gen'
import { newSessionFromSessionId } from './session'
import { LocalStore, Store, StoreObj } from './store'
import {
  SendDelayedEncodeArgs,
  SendERC1155Args,
  SendERC20Args,
  SendERC721Args,
  SignMessageArgs,
  SendTransactionsArgs,
  SignedIntent,
  GetTransactionReceiptArgs
} from './intents'
import {
  MaySentTransactionResponse,
  SignedMessageResponse,
  FeeOptionsResponse,
  isGetSessionResponse,
  isMaySentTransactionResponse,
  isSignedMessageResponse,
  isValidationRequiredResponse,
  isFinishValidateSessionResponse,
  isCloseSessionResponse,
  isTimedOutTransactionResponse,
  isFeeOptionsResponse,
  isSessionAuthProofResponse
} from './intents/responses'
import { WaasAuthenticator, Session, Chain } from './clients/authenticator.gen'
import { jwtDecode } from 'jwt-decode'
import { SimpleNetwork, WithSimpleNetwork } from './networks'
import { LOCAL } from './defaults'
import { EmailAuth } from './email'
import { ethers } from 'ethers'

export type Sessions = (Session & { isThis: boolean })[]

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

export type Identity = {
  idToken: string
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

export function parseSequenceWaaSConfigKey<T>(key: string): Partial<T> {
  return JSON.parse(atob(key))
}

export function defaultArgsOrFail(
  config: SequenceConfig & Partial<ExtendedSequenceConfig>,
  preset: ExtendedSequenceConfig
): Required<SequenceConfig> & Required<WaaSConfigKey> & ExtendedSequenceConfig {
  const key = (config as any).waasConfigKey
  const keyOverrides = key ? parseSequenceWaaSConfigKey<SequenceConfig & WaaSConfigKey & ExtendedSequenceConfig>(key) : {}
  const preconfig = { ...preset, ...config, ...keyOverrides }

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
  private validationRequiredSalt: string

  public readonly config: Required<SequenceConfig> & Required<WaaSConfigKey> & ExtendedSequenceConfig

  private readonly deviceName: StoreObj<string | undefined>

  private emailClient: EmailAuth | undefined

  constructor(
    config: SequenceConfig & Partial<ExtendedSequenceConfig>,
    preset: ExtendedSequenceConfig = LOCAL,
    private readonly store: Store = new LocalStore()
  ) {
    this.config = defaultArgsOrFail(config, preset)
    this.waas = new SequenceWaaSBase({ network: 1, ...config }, this.store)
    this.client = new WaasAuthenticator(this.config.rpcServer, window.fetch)
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

    const res = await this.client.sendIntent({ intent: intent }, this.headers())
    return res.response
  }

  async isSignedIn() {
    return this.waas.isSignedIn()
  }

  async signIn(creds: Identity, name: string): Promise<{ sessionId: string; wallet: string }> {
    // TODO: Be smarter about this, for cognito (or some other cases) we may
    // want to send the email instead of the idToken
    const signInIntent = await this.waas.signIn({
      idToken: creds.idToken
    })

    // Login on WaaS
    const decoded = jwtDecode(creds.idToken)

    if (!decoded.iss) {
      throw new Error('Invalid idToken')
    }

    const args = {
      intent: signInIntent,
      friendlyName: name
    }

    await this.deviceName.set(name)

    try {
      const res = await this.client.registerSession(args, this.headers())

      await this.waas.completeSignIn({
        code: 'sessionOpened',
        data: {
          sessionId: res.session.id,
          wallet: res.response.data.wallet
        }
      })

      return {
        sessionId: res.session.id,
        wallet: res.response.data.wallet
      }
    } catch (e) {
      await this.waas.completeSignOut()
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
      const session = await newSessionFromSessionId(thisSessionId)
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
}
