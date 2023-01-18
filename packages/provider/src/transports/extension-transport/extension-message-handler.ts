import { WalletRequestHandler } from '../wallet-request-handler'
import { BaseWalletTransport } from '../base-wallet-transport'
import { InitState, ProviderMessage } from '../../types'
import { Runtime } from 'webextension-polyfill'
import { logger } from '@0xsequence/utils'

export const CHANNEL_ID = 'sequence-extension-message-handler'

export class ExtensionMessageHandler extends BaseWalletTransport {
  private port: any

  constructor(walletRequestHandler: WalletRequestHandler, public runtime: Runtime.Static) {
    super(walletRequestHandler)
    this._init = InitState.OK
  }

  register() {
    this._registered = true
    this.port = this.runtime.connect({ name: CHANNEL_ID })
  }

  sendMessage(message: ProviderMessage<any>) {
    logger.info('[ExtensionMessageHandler send]', message)
    this.port.postMessage(message)
  }
}
