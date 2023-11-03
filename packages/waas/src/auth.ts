import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers'
import { SequenceWaaSBase } from "./base"
import { LocalStore, Store, StoreObj } from "./store"
import { Payload } from "./payloads";
import { SendTransactionResponse, SignedMessageResponse, isSendTransactionResponse, isSignedMessageResponse, isValidationRequiredResponse } from "./payloads/responses";
import { WaasAuthenticator, Session, RegisterSessionPayload, SendIntentPayload, ListSessionsPayload, DropSessionPayload } from "./clients/authenticator.gen";
import { DEFAULTS } from "./defaults"
import { jwtDecode } from "jwt-decode"
import { GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms'
import { SendDelayedEncodeArgs, SendERC1155Args, SendERC20Args, SendERC721Args, SendTransactionsArgs } from './payloads/packets/transactions';
import { SignMessageArgs } from './payloads/packets/messages';
import { SimpleNetwork, WithSimpleNetwork } from './networks';

export type Sessions = (Session & { isThis: boolean })[]

export type SequenceExplicitConfig = {
  secret?: string,
  tenant?: number,
}

export type SequenceKeyConfig = {
  key: string,
}

export type SequenceConfig = (SequenceExplicitConfig | SequenceKeyConfig) & {
  network?: SimpleNetwork,
}

export type ExtendedSequenceConfig = {
  rpcServer: string;
  kmsRegion: string;
  idpRegion: string;
  keyId: string;
  identityPoolId: string;
  endpoint: string;
}

export type Identity = {
  idToken: string
}

function encodeHex(data: string | Uint8Array) {
  return "0x" + Array.from(
    typeof(data) === 'string' ? new TextEncoder().encode(data) : data,
    byte => byte.toString(16).padStart(2, '0'),
  ).join("")
}

function decodeHex(hex: string) {
  return new Uint8Array(hex.substring(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
}

export type ValidationArgs = {
  onValidationRequired?: () => boolean
  redirectURL?: string
}

export type CommonAuthArgs = {
  validation?: ValidationArgs,
  identifier?: string,
}

export function parseApiKey<T>(key: string): Partial<T> {
  const json = Buffer.from(key, 'base64').toString('utf8')
  return JSON.parse(json)
}


export function defaultArgsOrFail(
  config: SequenceConfig & Partial<ExtendedSequenceConfig>
): Required<SequenceExplicitConfig> & ExtendedSequenceConfig {
  const key = (config as any).key
  const keyOverrides = key ? parseApiKey<SequenceExplicitConfig & ExtendedSequenceConfig>(key) : {}
  const preconfig = { ...DEFAULTS.auth, ...config, ...keyOverrides }

  if (preconfig.network === undefined) {
    preconfig.network = 1
  }

  if (preconfig.tenant === undefined) {
    throw new Error('Missing tenant')
  }

  if (preconfig.secret === undefined) {
    throw new Error('Missing secret')
  }

  return preconfig as Required<SequenceExplicitConfig> & ExtendedSequenceConfig
}

export class Sequence {
  private waas: SequenceWaaSBase
  private client: WaasAuthenticator

  private validationRequiredCallback: (() => void)[] = []

  public readonly config: Required<SequenceExplicitConfig> & ExtendedSequenceConfig

  private readonly kmsKey: StoreObj<string | undefined>
  private readonly deviceName: StoreObj<string | undefined>

  constructor (
    config: SequenceConfig & Partial<ExtendedSequenceConfig>,
    private readonly store: Store = new LocalStore(),
    private readonly guardUrl: string = DEFAULTS.guard
  ) {
    this.config = defaultArgsOrFail(config)
    this.waas = new SequenceWaaSBase({ network: 1, ...config }, this.store, this.guardUrl)
    this.client = new WaasAuthenticator(this.config.rpcServer, window.fetch)
    this.kmsKey = new StoreObj(this.store, '@0xsequence.waas.auth.key', undefined)
    this.deviceName = new StoreObj(this.store, '@0xsequence.waas.auth.deviceName', undefined)
  }

  async onValidationRequired(callback: () => void) {
    this.validationRequiredCallback.push(callback)
    return () => {
      this.validationRequiredCallback = this.validationRequiredCallback.filter(c => c !== callback)
    }
  }

  private async handleValidationRequired({
    onValidationRequired,
    redirectURL,
  }: ValidationArgs = {}): Promise<boolean> {
    const proceed = onValidationRequired ? onValidationRequired() : true
    if (!proceed) {
      return false
    }

    for (const callback of this.validationRequiredCallback) {
      callback()
    }

    const intent = await this.waas.validateSession({
      redirectURL,
      deviceMetadata: await this.deviceName.get() ?? 'Unknown device',
    })

    await this.sendIntent(intent)

    return this.waas.waitForSessionValid()
  }

  private async useStoredCypherKey(): Promise<{ encryptedPayloadKey: string, plainHex: string }> {
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
    const dataKeyRes = await kmsClient.send(new GenerateDataKeyCommand({
      KeyId: this.config.keyId,
      KeySpec: 'AES_256',
    }))

    if (!dataKeyRes.CiphertextBlob || !dataKeyRes.Plaintext) {
      throw new Error("invalid response from KMS")
    }


    return this.kmsKey.set(JSON.stringify({
      encryptedPayloadKey: encodeHex(dataKeyRes.CiphertextBlob),
      plainHex: encodeHex(dataKeyRes.Plaintext),
    }))
  }

  private async sendIntent(intent: Payload<any>) {
    const payload: SendIntentPayload = {
      sessionId: await this.waas.getSessionID(),
      intentJson: JSON.stringify(intent, null, 0),
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

    const key = await window.crypto.subtle.importKey("raw", decodeHex(plainHex), cbcParams, false, ['encrypt'])
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))
    const encrypted = await window.crypto.subtle.encrypt(cbcParams, key, payloadBytes)
    const payloadCiphertext = encodeHex(new Uint8Array([ ...cbcParams.iv, ...new Uint8Array(encrypted) ]))
    const payloadSig = await this.waas.signUsingSessionKey(payloadBytes)
 
    return {
      headers: {
        'X-Sequence-Tenant': this.config.tenant,
        'X-Sequence-Secret': this.config.secret,
      },
      args: { encryptedPayloadKey, payloadCiphertext, payloadSig },
    }
  }

  async isSignedIn() {
    return this.waas.isSignedIn()
  }

  async signIn(creds: Identity, name: string) {
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
          [decoded.iss
            .replace('https://', '')
            .replace('http://', '')
          ]: creds.idToken,
        },
        clientConfig: { region: this.config.idpRegion },
      }),
    })

    await this.saveCypherKey(kmsClient)

    const payload: RegisterSessionPayload = {
      projectId: this.config.tenant,
      idToken: creds.idToken,
      sessionAddress: waaspayload.packet.session,
      friendlyName: name,
      intentJSON: JSON.stringify(waaspayload, null, 0),
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
    return res.session.address
  }

  private async refreshSession() {
    throw new Error('Not implemented')
  }

  async getSessionID() {
    return this.waas.getSessionID()
  }

  async dropSession({ sessionId, strict }: { sessionId?: string, strict?: boolean } = {}) {
    const thisSessionId = await this.waas.getSessionID()
    const closeSessionId = sessionId || thisSessionId

    try {
      // TODO: Use signed intents for dropping sessions
      // const packet = await this.waas.signOut({ sessionId })
      // const result = await this.sendIntent(packet)
      // console.log("TODO: Handle got result from drop session", result)
      const payload: DropSessionPayload = {
        dropSessionId: closeSessionId,
        sessionId: thisSessionId,
      }

      const { args, headers } = await this.preparePayload(payload)
      await this.client.dropSession(args, headers)
    } catch (e) {
      if (strict) {
        throw e
      }

      console.error(e)
    }

    if (closeSessionId.toLowerCase() === thisSessionId.toLowerCase()) {
      await this.waas.completeSignOut()
      this.kmsKey.set(undefined)
      this.deviceName.set(undefined)
    }
  }

  async listSessions(): Promise<Sessions> {
    const payload: ListSessionsPayload = {
      sessionId: await this.waas.getSessionID(),
    }

    const thisSessionAddress = await this.waas.getSessionID().then(id => id.toLowerCase())
    const { args, headers } = await this.preparePayload(payload)
    const res = await this.client.listSessions(args, headers)
    return res.sessions.map(session => ({
      ...session,
      isThis: session.address.toLowerCase() === thisSessionAddress,
    }))
  }

  // WaaS specific methods
  async getAddress() {
    return this.waas.getAddress()
  }

  async validateSession(args?: ValidationArgs) {
    if (await this.waas.isSessionValid()) {
      return true
    }

    return this.handleValidationRequired(args)
  }

  async isSessionValid() {
    return this.waas.isSessionValid()
  }

  async waitForSessionValid(timeout: number, pollRate: number) {
    return this.waas.waitForSessionValid(timeout, pollRate)
  }

  async useIdentifier<T extends CommonAuthArgs>(args: T): Promise<T & { identifier: string }> {
    if (args.identifier) {
      return args as T & { identifier: string }
    }

    // Generate a new identifier
    const identifier = `ts-sdk-${Date.now()}-${await this.waas.getSignerAddress()}`
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

  async sendTransaction(args: WithSimpleNetwork<SendTransactionsArgs> & CommonAuthArgs): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendTransaction(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isSendTransactionResponse)
  }

  async sendERC20(args: WithSimpleNetwork<SendERC20Args> & CommonAuthArgs): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendERC20(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isSendTransactionResponse)
  }

  async sendERC721(args: WithSimpleNetwork<SendERC721Args> & CommonAuthArgs): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendERC721(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isSendTransactionResponse)
  }

  async sendERC1155(args: WithSimpleNetwork<SendERC1155Args> & CommonAuthArgs): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendERC1155(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isSendTransactionResponse)
  }

  async callContract(args: WithSimpleNetwork<SendDelayedEncodeArgs> & CommonAuthArgs): Promise<SendTransactionResponse> {
    const intent = await this.waas.callContract(await this.useIdentifier(args))
    return this.trySendIntent(args, intent, isSendTransactionResponse)
  }
}
