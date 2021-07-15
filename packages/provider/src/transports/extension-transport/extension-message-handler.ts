import { WalletRequestHandler } from '../wallet-request-handler'
import { BaseWalletTransport } from '../base-wallet-transport'
import { InitState, ProviderMessage } from '../../types'

export const CHANNEL_ID = 'sequence-extension-message-handler'

export class ExtensionMessageHandler extends BaseWalletTransport {
  private port: any

  constructor(walletRequestHandler: WalletRequestHandler) {
    super(walletRequestHandler)
    this._init = InitState.OK
  }

  // from within extension execution context
  register() {
    this._registered = true

    // TODO: check execution context, throw if not an extension
    // TODO: support other browsers with polyfill
    // @ts-ignore
    this.port = chrome.runtime.connect({ name: CHANNEL_ID })
  }

  sendMessage(message: ProviderMessage<any>) {
    console.log('[ExtensionMessageHandler send]', message)
    this.port.postMessage(message)
  }
}
