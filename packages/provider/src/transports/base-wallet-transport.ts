import { ethers } from 'ethers'
import {
  WalletTransport, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageResponse, ProviderMessageTransport
} from '../types'

import { WalletRequestHandler } from './wallet-request-handler'

import { NetworkConfig, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export abstract class BaseWalletTransport implements WalletTransport {

  protected walletRequestHandler: WalletRequestHandler
  protected _sessionId: string

  constructor(walletRequestHandler: WalletRequestHandler) {
    this.walletRequestHandler = walletRequestHandler
  }

  register() {
    throw new Error('abstract method')
  }

  unregister() {
    throw new Error('abstract method')
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    throw new Error('abstract method')
  }

  handleMessage = async (message: ProviderMessage<any>) => {
    const request = message

    switch (request.type) {

      case ProviderMessageType.CONNECT: {

        // success, respond with 'connect' event to the dapp directly
        this.notifyConnect({ sessionId: this._sessionId })

        // notify account and network details depending on state
        const accountAddress = await this.walletRequestHandler.getAddress()

        if (accountAddress && accountAddress.startsWith('0x')) {
          // logged in
          this.notifyAccountsChanged([accountAddress])

          const networks = await this.walletRequestHandler.getNetworks()
          if (networks && networks.length > 0) {
            this.notifyNetworks(networks)
            this.notifyChainChanged(ethers.utils.hexlify(networks[0].chainId))
          }

        } else {
          // not logged in, we do not emit chain details until logged in
          this.notifyAccountsChanged([])
        }

        return
      }

      case ProviderMessageType.MESSAGE: {
        const response = await this.walletRequestHandler.sendMessageRequest(request)
        this.sendMessage(response)

        if (response.data.error) {
          // TODO: for certain errors, whenever we want to render something to the UI
          // we should throw
        }
        return
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

  notifyConnect(connectInfo: { chainId?: string, sessionId?: string }) {
    const { chainId, sessionId } = connectInfo
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.CONNECT,
      data: {
        result: { chainId, sessionId }
      }
    })
  }

  notifyAccountsChanged(accounts: string[]) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.ACCOUNTS_CHANGED,
      data: accounts
    })
  }

  notifyChainChanged(hexChainId: string) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.CHAIN_CHANGED,
      data: hexChainId
    })
  }

  notifyNetworks(networks: NetworkConfig[]) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.NETWORKS,
      data: networks
    })
  }

}
