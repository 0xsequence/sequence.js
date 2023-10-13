import { ethers } from "ethers";
import { Sequence } from "./sequence"
import { Store } from "./store"
import { Payload } from "./payloads";
import { SendTransactionResponse, isSendTransactionResponse, isValidationRequiredResponse } from "./payloads/responses";
import { WaasAuthenticator, Session } from "./clients/authenticator.gen";

export class SequenceAuth {
  private waas: Sequence
  private client: WaasAuthenticator

  private validationRequiredCallback: (() => void)[] = []

  constructor (
    private readonly url: string,
    private readonly store: Store,
    private readonly guardUrl: string
  ) {
    this.waas = new Sequence(this.store, this.guardUrl)
    this.client = new WaasAuthenticator(this.url, window.fetch)
  }

  private async sendIntent(intent: Payload<any>) {
    return this.client.sendIntent({ intentJson: JSON.stringify(intent, null, 0) })
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

  async signIn() {
    throw new Error('Not implemented')
  }

  private async refreshSession() {
    return this.client.refreshSession()
  }

  async dropSession(id: string) {
    return this.client.dropSession({ id })
  }

  async listSessions(): Promise<Session[]> {
    const res = await this.client.listSessions()
    return res.sessions
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
