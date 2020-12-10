import {
  WalletTransport, JsonRpcRequest, JsonRpcResponseCallback, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageResponse, ProviderMessageTransport
} from '../types'
import { WalletRequestHandler } from './wallet-request-handler'

export class BaseWalletTransport implements WalletTransport {

  protected walletRequestHandler: WalletRequestHandler

  constructor(walletRequestHandler: WalletRequestHandler) {
    this.walletRequestHandler = walletRequestHandler
  }

  register() {
    throw Error('abstract method')
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    throw Error('abstract method')
  }

  handleMessage = async (message: ProviderMessage<any>) => {
    const request = message

    switch (request.type) {
      case ProviderMessageType.CONNECT: {

        // check connect request state
        // if (request.payload?.state?.login) {
        //   this.isLoginRequest.set(true)
        // }

        // respond to the dapp directly
        this.sendMessage({
          idx: request.idx,
          type: ProviderMessageType.CONNECT,
          data: null
        })

        // TODO/XXX
        // this.notifyNetwork(this.root.walletStore.network.get())
        // this.notifyLogin(this.wallet.address)
        // ^------ this.walletRequetHandler , maybe rename it to this.walletHandler ..

        break
      }

      case ProviderMessageType.MESSAGE: {
        const response = await this.walletRequestHandler.sendMessageRequest(request)
        this.sendMessage(response)
        break
      }

      default: {
        console.error('unknown payload type for event', event)
      }
    }
  }

  // sendMessageRequest sends a ProviderMessageRequest to the wallet post-message transport
  sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
    return this.walletRequestHandler.sendMessageRequest(message)
  }

  sendMessage(message: ProviderMessage<any>) {
    throw Error('abstract method')
  }

  // TODO/XXX: below methods should be called by the wallet-webapp whenever state changes
  // of the wallet..
  // HMMM: when we have multiple potential transports though, we only need to send
  // through transports that are connected..?

  notifyConnect(connectInfo: any) { // TODO: make it ProviderConnectInfo
    this.sendMessage({
      idx: -1, // not related to a response
      type: ProviderMessageType.CONNECT,
      data: null
    } as ProviderMessage<number>)
  }

  notifyDisconnect(error?: any) { //ProviderRpcError) { // TODO: make it ProviderConnectInfo
    this.sendMessage({
      idx: -1, // not related to a response
      type: ProviderMessageType.DISCONNECT,
      data: null
    })
  }

  notifyAccountsChanged(accounts: string[]) {
  }

  notifyChainChanged(connectInfo: any) { // TODO: ProviderConnectInfo
  }

  notifyLogin(accountAddress: string) {
  }

  notifyLogout() {
  }

  // TODO/XXX: keep?
  notifyNetwork(network: any) { // TODO: (network: NetworkConfig)
  }

}
