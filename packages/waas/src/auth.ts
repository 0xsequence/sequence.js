import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers'
import { ethers } from "ethers";
import { Sequence } from "./sequence"
import { LocalStore, Store, StoreObj } from "./store"
import { Payload } from "./payloads";
import { SendTransactionResponse, isSendTransactionResponse, isValidationRequiredResponse } from "./payloads/responses";
import { WaasAuthenticator, Session, RegisterSessionPayload } from "./clients/authenticator.gen";
import { DEFAULTS } from "./defaults"
import { jwtDecode } from "jwt-decode"
import { GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms'

export interface AuthConfig {
  key: string,
  teenant: number,
}

export type ExtendedAuthConfig = {
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

export class SequenceAuth {
  private waas: Sequence
  private client: WaasAuthenticator

  private validationRequiredCallback: (() => void)[] = []

  public readonly config: AuthConfig & ExtendedAuthConfig

  private readonly jwtCredentials: StoreObj<string | undefined>

  constructor (
    config: AuthConfig & Partial<ExtendedAuthConfig>,
    private readonly store: Store = new LocalStore(),
    private readonly guardUrl: string = DEFAULTS.guard
  ) {
    this.config = { ...DEFAULTS.auth, ...config }
    this.waas = new Sequence(this.store, this.guardUrl)
    this.client = new WaasAuthenticator(this.config.rpcServer, window.fetch)
  }

  private async sendIntent(intent: Payload<any>) {
    throw new Error('Not implemented')
    // return this.client.sendIntent({ intentJson: JSON.stringify(intent, null, 0) })
  }

  async onValidationRequired(callback: () => void) {
    this.validationRequiredCallback.push(callback)
    return () => {
      this.validationRequiredCallback = this.validationRequiredCallback.filter(c => c !== callback)
    }
  }

  private async handleValidationRequired(extraCallback?: () => boolean): Promise<boolean> {
    const proceed = extraCallback ? extraCallback() : true
    if (!proceed) {
      return false
    }

    for (const callback of this.validationRequiredCallback) {
      callback()
    }

    const intent = await this.waas.validateSession()
    await this.sendIntent(intent)

    return this.waas.waitForSessionValid()
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
          [decoded.iss]: creds.idToken,
        },
        clientConfig: { region: this.config.idpRegion },
      }),
    })

    const payload: RegisterSessionPayload = {
      projectId: this.config.teenant,
      idToken: creds.idToken,
      sessionAddress: waaspayload.packet.session,
      friendlyName: name,
      intentJSON: JSON.stringify(waaspayload, null, 0),
    }

    const { args, headers } = await this.preparePayload(kmsClient, payload)
    const res = await this.client.registerSession(args, {
      ...headers,
      'X-Sequence-Tenant': this.config.teenant,
    })

    await this.waas.completeSignIn({
      code: 'sessionOpened',
      data: {
        sessionId: res.session.id,
        wallet: res.session.address
      }
    })

    return res.session.address
  }

  private async preparePayload(kmsClient: KMSClient, payload: Object) {
    const dataKeyRes = await kmsClient.send(new GenerateDataKeyCommand({
      KeyId: this.config.keyId,
      KeySpec: 'AES_256',
    }))

    if (!dataKeyRes.CiphertextBlob || !dataKeyRes.Plaintext) {
      throw new Error("invalid response from KMS")
    }

    const encryptedPayloadKey = encodeHex(dataKeyRes.CiphertextBlob)

    const cbcParams = {
      name: 'AES-CBC',
      iv: window.crypto.getRandomValues(new Uint8Array(16))
    }
    const key = await window.crypto.subtle.importKey("raw", dataKeyRes.Plaintext, cbcParams, false, ['encrypt'])

    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))
    const encrypted = await window.crypto.subtle.encrypt(cbcParams, key, payloadBytes)
    const payloadCiphertext = encodeHex(new Uint8Array([ ...cbcParams.iv, ...new Uint8Array(encrypted) ]))
    const payloadSig = await this.waas.signUsingSessionKey(payloadCiphertext)

    return {
      headers: { 'X-Sequence-Tenant': this.config.teenant },
      args: { encryptedPayloadKey, payloadCiphertext, payloadSig },
    }
  }

  private async refreshSession() {
    throw new Error('Not implemented')
    // return this.client.refreshSession()
  }

  async dropSession(id: string) {
    throw new Error('Not implemented')
    // return this.client.dropSession({ id })
  }

  async listSessions(): Promise<Session[]> {
    throw new Error('Not implemented')
    // const res = await this.client.listSessions()
    // return res.sessions
  }

  // WaaS specific methods
  async getAddress() {
    return this.waas.getAddress()
  }

  async validateSession() {
    if (await this.waas.isSessionValid()) {
      return true
    }

    return this.handleValidationRequired()
  }

  async isSessionValid() {
    return this.waas.isSessionValid()
  }

  async waitForSessionValid(timeout: number, pollRate: number) {
    return this.waas.waitForSessionValid(timeout, pollRate)
  }

  async sendTransaction(
    options: {
      chainId: number,
      onValidationRequired?: () => boolean
    },
    ...transactions: ethers.providers.TransactionRequest[]
  ): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendTransaction(options.chainId, ...transactions)
    const response = await this.sendIntent(intent)

    if (isSendTransactionResponse(response)) {
      return response
    }

    if (isValidationRequiredResponse(response)) {
      const proceed = await this.handleValidationRequired(options.onValidationRequired)
      if (proceed) {
        return this.sendTransaction({
          ...options,
          onValidationRequired: () => {
            console.warn('Validation required callback called twice')
            return false
          }
        }, ...transactions)
      }
    }

    return Promise.reject(new Error('Invalid response'))
  }

  async sendERC20(
    options: {
      chainId: number,
      onValidationRequired?: () => boolean
    },
    token: string,
    to: string,
    value: ethers.BigNumberish
  ): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendERC20(options.chainId, token, to, value)
    const response = await this.sendIntent(intent)

    if (isSendTransactionResponse(response)) {
      return response
    }

    if (isValidationRequiredResponse(response)) {
      const proceed = await this.handleValidationRequired(options.onValidationRequired)
      if (proceed) {
        return this.sendERC20({
          ...options,
          onValidationRequired: () => {
            console.warn('Validation required callback called twice')
            return false
          }
        }, token, to, value)
      }
    }

    return Promise.reject(new Error('Invalid response'))
  }

  async sendERC721(
    options: {
      chainId: number,
      onValidationRequired?: () => boolean
    },
    token: string,
    to: string,
    id: string
  ): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendERC721(options.chainId, token, to, id)
    const response = await this.sendIntent(intent)

    if (isSendTransactionResponse(response)) {
      return response
    }

    if (isValidationRequiredResponse(response)) {
      const proceed = await this.handleValidationRequired(options.onValidationRequired)
      if (proceed) {
        return this.sendERC721({
          ...options,
          onValidationRequired: () => {
            console.warn('Validation required callback called twice')
            return false
          }
        }, token, to, id)
      }
    }

    return Promise.reject(new Error('Invalid response'))
  }

  async sendERC1155(
    options: {
      chainId: number,
      onValidationRequired?: () => boolean
    },
    token: string,
    to: string,
    values: {
      id: string,
      amount: ethers.BigNumberish
    }[]
  ): Promise<SendTransactionResponse> {
    const intent = await this.waas.sendERC1155(options.chainId, token, to, values)
    const response = await this.sendIntent(intent)

    if (isSendTransactionResponse(response)) {
      return response
    }

    if (isValidationRequiredResponse(response)) {
      const proceed = await this.handleValidationRequired(options.onValidationRequired)
      if (proceed) {
        return this.sendERC1155({
          ...options,
          onValidationRequired: () => {
            console.warn('Validation required callback called twice')
            return false
          }
        }, token, to, values)
      }
    }

    return Promise.reject(new Error('Invalid response'))
  }
}
