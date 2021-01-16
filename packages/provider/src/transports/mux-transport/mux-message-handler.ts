import { BaseWalletTransport } from '../base-wallet-transport'
import { WalletRequestHandler } from '../wallet-request-handler'
import { ProviderMessage } from '../../types'

export class MuxMessageHandler extends BaseWalletTransport {


  constructor(walletRequestHandler: WalletRequestHandler) { //, port: ProxyMessageChannelPort) {
    super(walletRequestHandler)
    // this.port = port
  }

  // register() {
  //   this.port.handleMessage = (message: ProviderMessage<any>): void => {
  //     this.handleMessage(message)
  //   }
  // }

  // sendMessage(message: ProviderMessage<any>) {
  //   this.port.sendMessage(message)
  // }

}
