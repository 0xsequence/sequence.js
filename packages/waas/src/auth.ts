import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers'
import { SequenceWaaSBase } from './base'
import { LocalStore, Store, StoreObj } from './store'
import { Payload } from './payloads'
import {
  MaySentTransactionResponse,
  SignedMessageResponse,
  isGetSessionResponse,
  isMaySentTransactionResponse,
  isSignedMessageResponse,
  isValidationRequiredResponse,
  isFinishValidateSessionResponse
} from './payloads/responses'
import {
  WaasAuthenticator,
  Session,
  RegisterSessionPayload,
  SendIntentPayload,
  ListSessionsPayload,
  DropSessionPayload,
  Chain
} from './clients/authenticator.gen'
import { jwtDecode } from 'jwt-decode'
import { GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms'
import {
  SendDelayedEncodeArgs,
  SendERC1155Args,
  SendERC20Args,
  SendERC721Args,
  SendTransactionsArgs
} from './payloads/packets/transactions'
import { SignMessageArgs } from './payloads/packets/messages'
import { SimpleNetwork, WithSimpleNetwork } from './networks'
import { LOCAL } from './defaults'
import { EmailAuth } from './email'

export type Sessions = (Session & { isThis: boolean })[]

export type SequenceConfig = {
  projectAccessKey: string
  waasConfigKey: string
  network?: SimpleNetwork
}

export type ExtendedSequenceConfig = {
  rpcServer: string
  kmsRegion: string
  idpRegion: string
  keyId: string
  emailRegion?: string
  endpoint?: string
}

export type WaaSConfigKey = {
  projectId: number
  identityPoolId: string
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

  if (preconfig.identityPoolId === undefined) {
    throw new Error('Missing identityPoolId')
  }

  return preconfig as Required<SequenceConfig> & Required<WaaSConfigKey> & ExtendedSequenceConfig
}

export class Sequence {
  private waas: SequenceWaaSBase
  private client: WaasAuthenticator

  private validationRequiredCallback: (() => void)[] = []
  private validationRequiredSalt: string

  public readonly config: Required<SequenceConfig> & Required<WaaSConfigKey> & ExtendedSequenceConfig

  private readonly kmsKey: StoreObj<string | undefined>
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
    this.kmsKey = new StoreObj(this.store, '@0xsequence.waas.auth.key', undefined)
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

  private async useStoredCypherKey(): Promise<{ encryptedPayloadKey: string; plainHex: string }> {
    const raw = await this.kmsKey.get()
    if (!raw) {
      throw new Error('No stored key')
    }

    const decoded = JSON.parse(raw)
    if (decoded.encryptedPayloadKey && decoded.plainHex) {
      return decoded
    }

    throw new Error('Invalid stored key')
  }

  private async saveCypherKey(kmsClient: KMSClient) {
    const dataKeyRes = await kmsClient.send(
      new GenerateDataKeyCommand({
        KeyId: this.config.keyId,
        KeySpec: 'AES_256'
      })
    )

    if (!dataKeyRes.CiphertextBlob || !dataKeyRes.Plaintext) {
      throw new Error('invalid response from KMS')
    }

    return this.kmsKey.set(
      JSON.stringify({
        encryptedPayloadKey: encodeHex(dataKeyRes.CiphertextBlob),
        plainHex: encodeHex(dataKeyRes.Plaintext)
      })
    )
  }

  private async sendIntent(intent: Payload<any>) {
    const sessionId = await this.waas.getSessionID()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const payload: SendIntentPayload = {
      sessionId: sessionId,
      intentJson: JSON.stringify(intent, null, 0)
    }

    const { args, headers } = await this.preparePayload(payload)

    return this.client.sendIntent(args, headers)
  }

  private async preparePayload(payload: Object) {
    const { encryptedPayloadKey, plainHex } = await this.useStoredCypherKey()

    const cbcParams = {
      name: 'AES-CBC',
      iv: window.crypto.getRandomValues(new Uint8Array(16))
    }

    const key = await window.crypto.subtle.importKey('raw', decodeHex(plainHex), cbcParams, false, ['encrypt'])
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))
    const encrypted = await window.crypto.subtle.encrypt(cbcParams, key, payloadBytes)
    const payloadCiphertext = encodeHex(new Uint8Array([...cbcParams.iv, ...new Uint8Array(encrypted)]))
    const payloadSig = await this.waas.signUsingSessionKey(payloadBytes)

    return {
      headers: {
        'X-Access-Key': this.config.projectAccessKey
      },
      args: { encryptedPayloadKey, payloadCiphertext, payloadSig }
    }
  }

  async isSignedIn() {
    return this.waas.isSignedIn()
  }

  async signIn(creds: Identity, name: string): Promise<{ sessionId: string, wallet: string }> {
    // TODO: Be smarter about this, for cognito (or some other cases) we may
    // want to send the email instead of the idToken
    const waaspayload = await this.waas.signIn({
      idToken: creds.idToken
    })

    // Login on WaaS
    const decoded = jwtDecode(creds.idToken)

    if (!decoded.iss) {
      throw new Error('Invalid idToken')
    }

    const kmsClient = new KMSClient({
      region: this.config.kmsRegion,
      endpoint: this.config.endpoint,
      credentials: fromCognitoIdentityPool({
        identityPoolId: this.config.identityPoolId,
        logins: {
          [decoded.iss.replace('https://', '').replace('http://', '')]: creds.idToken
        },
        clientConfig: { region: this.config.idpRegion }
      })
    })

    await this.saveCypherKey(kmsClient)

    const payload: RegisterSessionPayload = {
      projectId: this.config.projectId,
      idToken: creds.idToken,
      sessionId: waaspayload.packet.sessionId,
      friendlyName: name,
      intentJSON: JSON.stringify(waaspayload, null, 0)
    }

    const { args, headers } = await this.preparePayload(payload)
    const res = await this.client.registerSession(args, headers)

    await this.waas.completeSignIn({
      code: 'sessionOpened',
      data: {
        sessionId: res.session.id,
        wallet: res.data.wallet
      }
    })

    this.deviceName.set(name)

    return {
      sessionId: res.session.id,
      wallet: res.data.wallet
    }
  }

  private async refreshSession() {
    throw new Error('Not implemented')
  }

  async getSessionID() {
    return this.waas.getSessionID()
  }

  async dropSession({ sessionId, strict }: { sessionId?: string; strict?: boolean } = {}) {
    const thisSessionId = await this.waas.getSessionID()
    if (!thisSessionId) {
      throw new Error('session not open')
    }

    const closeSessionId = sessionId || thisSessionId

    try {
      // TODO: Use signed intents for dropping sessions
      // const packet = await this.waas.signOut({ sessionId })
      // const result = await this.sendIntent(packet)
      // console.log("TODO: Handle got result from drop session", result)
      const payload: DropSessionPayload = {
        dropSessionId: closeSessionId,
        sessionId: thisSessionId
      }

      const { args, headers } = await this.preparePayload(payload)
      await this.client.dropSession(args, headers)
    } catch (e) {
      if (strict) {
        throw e
      }

      console.error(e)
    }

    if (closeSessionId === thisSessionId) {
      await this.waas.completeSignOut()
      this.kmsKey.set(undefined)
      this.deviceName.set(undefined)
    }
  }

  async listSessions(): Promise<Sessions> {
    const sessionId = await this.waas.getSessionID()
    if (!sessionId) {
      throw new Error('session not open')
    }

    const payload: ListSessionsPayload = {
      sessionId: sessionId
    }

    const { args, headers } = await this.preparePayload(payload)
    const res = await this.client.listSessions(args, headers)
    return res.sessions.map(session => ({
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
    const payload = await this.waas.getSession()
    const result = await this.sendIntent(payload)

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

  async useIdentifier<T extends CommonAuthArgs>(args: T): Promise<T & { identifier: string }> {
    if (args.identifier) {
      return args as T & { identifier: string }
    }

    // Generate a new identifier
    const identifier = `ts-sdk-${Date.now()}-${await this.waas.getSignerVerifier()}`
    return { ...args, identifier } as T & { identifier: string }
  }

  private async trySendIntent<T>(
    args: CommonAuthArgs,
    intent: Payload<any>,
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

  async sendTransaction(args: WithSimpleNetwork<SendTransactionsArgs> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendTransaction(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isMaySentTransactionResponse)
  }

  async sendERC20(args: WithSimpleNetwork<SendERC20Args> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendERC20(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isMaySentTransactionResponse)
  }

  async sendERC721(args: WithSimpleNetwork<SendERC721Args> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendERC721(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isMaySentTransactionResponse)
  }

  async sendERC1155(args: WithSimpleNetwork<SendERC1155Args> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.sendERC1155(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isMaySentTransactionResponse)
  }

  async callContract(args: WithSimpleNetwork<SendDelayedEncodeArgs> & CommonAuthArgs): Promise<MaySentTransactionResponse> {
    const intent = await this.waas.callContract(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isMaySentTransactionResponse)
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
        isEnabled: chain.isEnabled,
      })
    }
    return networks
  }
}
