import { BaseWalletTransport } from '../base-wallet-transport'
import { WalletRequestHandler } from '../wallet-request-handler'
import { InitState, ProviderMessage } from '../../types'
import { ProxyMessageChannelPort } from './proxy-message-channel'

export class ProxyMessageHandler extends BaseWalletTransport {
  private port: ProxyMessageChannelPort

  constructor(walletRequestHandler: WalletRequestHandler, port: ProxyMessageChannelPort) {
    super(walletRequestHandler)
    this.port = port
    this._init = InitState.OK
  }

  register() {
    this.port.handleMessage = (message: ProviderMessage<any>): void => {
      this.handleMessage(message)
    }
    this._registered = true
  }

  // note: we can't decide whether to restore the session within register(), because session info is
  // received asyncronously via EventType.OPEN after register() is executed.
  // And in the case of a redirect/reload, EventType.OPEN is not sent at all,
  // because the wallet is already open.
  //
  // call this method from wallet redirect hander when a session restore is needed
  async restoreSession() {
    const cachedSession = await this.getCachedTransportSession()
    if (cachedSession) {
      this.open(cachedSession)
    }
  }

  unregister() {
    // @ts-ignore
    this.port.handleMessage = undefined
    this._registered = false
  }

  sendMessage(message: ProviderMessage<any>) {
    this.port.sendMessage(message)
  }
}
