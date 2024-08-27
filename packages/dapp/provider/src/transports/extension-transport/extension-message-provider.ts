import { InitState, OpenWalletIntent, ProviderMessage } from '../../types'
import { BaseProviderTransport } from '../base-provider-transport'
import { CHANNEL_ID } from './extension-message-handler'

import { Runtime } from 'webextension-polyfill'

export class ExtensionMessageProvider extends BaseProviderTransport {
  constructor(runtime: Runtime.Static) {
    super()

    runtime.onConnect.addListener(port => {
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

  sendMessage(message: ProviderMessage<any>) {
    //noop
  }

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
