import {
  WalletTransport, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageResponse, ProviderMessageTransport
} from '../types'

import { WalletRequestHandler } from '../wallet-request-handler'

import { NetworkConfig, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export abstract class BaseWalletTransport implements WalletTransport {

  protected walletRequestHandler: WalletRequestHandler
  protected _connectId: string

  constructor(walletRequestHandler: WalletRequestHandler) {
    this.walletRequestHandler = walletRequestHandler
  }

  register() {
    throw new Error('abstract method')
  }

  unregister() {
    throw new Error('abstract method')
  }

  init() {
    // TODO... keep this, and add network -- in case someone does change network, etc from walletHandler
    // once we integrate into wallet-webapp will become more clear.
    // XXX
    //
    // this.walletRequestHandler.on('login', (accountAddress: string) => {
    //   this.notifyLogin(accountAddress)
    // })
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    throw new Error('abstract method')
  }

  handleMessage = async (message: ProviderMessage<any>) => {
    const request = message

    switch (request.type) {
      case ProviderMessageType.CONNECT: {

        // TODO/XXX: does this matter anymore?
        //
        // check connect request state
        // if (request.payload?.state?.login) {
        //   this.isLoginRequest.set(true)
        // }

        // respond with 'connect' event to the dapp directly
        this.sendMessage({
          idx: request.idx,
          type: ProviderMessageType.CONNECT,
          data: this._connectId
        })

        this.notifyNetworks(await this.walletRequestHandler.getNetworks())
        this.notifyLogin(await this.walletRequestHandler.getAddress())

        // TODO: perhaps send accountsChanged and chainChanged as well..?

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
    throw new Error('abstract method')
  }

  notifyAccountsChanged(accounts: string[]) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.LOGIN,
      data: accounts
    })
  }

  // TODO: connectInfo seems wrong..? lets just have it hexChainId: string
  notifyChainChanged(connectInfo: any) { // TODO: ProviderConnectInfo
    // TODO: .. hmfp... format..?
  }

  notifyNetworks(networks: NetworkConfig[]) {
    // TODO: ensure "networks" when json stringifying omits the objects..
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.NETWORKS,
      data: networks
    })
  }

  notifyLogin(accountAddress: string) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.LOGIN,
      data: accountAddress
    })
  }

  notifyLogout() {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.LOGOUT,
      data: null
    })
  }

}
