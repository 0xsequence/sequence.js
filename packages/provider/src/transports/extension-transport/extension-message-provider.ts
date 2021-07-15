import { InitState, OpenWalletIntent, ProviderMessage } from '../../types'
import { BaseProviderTransport } from '../base-provider-transport'
import { CHANNEL_ID } from './extension-message-handler'

export class ExtensionMessageProvider extends BaseProviderTransport {
  constructor() {
    super()

    // TODO: check execution context, throw if not an extension
    // TODO: support other browsers with polyfill
    //@ts-ignore
    chrome.runtime.onConnect.addListener(port => {
      if (port.name === CHANNEL_ID) {
        this._init = InitState.OK

        port.onMessage.addListener((message: ProviderMessage<any>) => {
          this.handleMessage(message)
        })
      }
    })
  }

  register = () => {
    this._registered = true
  }

  sendMessage(message: ProviderMessage<any>) {}

  unregister() {
    //noop
  }

  openWallet(path?: string, intent?: OpenWalletIntent, networkId?: string | number) {
    //noop
  }

  closeWallet() {
    //noop
  }
}
