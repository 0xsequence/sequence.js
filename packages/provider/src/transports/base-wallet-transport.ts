import { ethers } from 'ethers'
import {
  WalletTransport, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageResponse, ProviderMessageTransport
} from '../types'

import { WalletRequestHandler } from './wallet-request-handler'

import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'

export abstract class BaseWalletTransport implements WalletTransport {

  protected walletRequestHandler: WalletRequestHandler
  protected _sessionId: string
  protected _registered: boolean

  constructor(walletRequestHandler: WalletRequestHandler) {
    this.walletRequestHandler = walletRequestHandler

    this.walletRequestHandler.on('accountsChanged', (accounts: string[]) => {
      if (!this.registered) return
      this.notifyAccountsChanged(accounts)
    })

    this.walletRequestHandler.on('networks', (networks: NetworkConfig[]) => {
      if (!this.registered) return
      this.notifyNetworks(networks)
      if (!networks || networks.length === 0) {
        this.notifyChainChanged('0x0')
      } else {
        this.notifyChainChanged(ethers.utils.hexlify(networks[0].chainId))
      }
    })

    // TODO: add .on('chainChanged') event? or covered by networks?

    this.walletRequestHandler.on('walletContext', (walletContext: WalletContext) => {
      if (!this.registered || !walletContext) return
      this.notifyWalletContext(walletContext)
    })

  }

  get registered(): boolean {
    return this._registered
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

        // notify wallet context
        await this.walletRequestHandler.notifyWalletContext()

        // notify account and network details depending on state
        const accountAddress = await this.walletRequestHandler.getAddress()

        if (accountAddress && accountAddress.startsWith('0x')) {
          // logged in
          this.notifyAccountsChanged([accountAddress])
        } else {
          // not logged in, we do not emit chain details until logged in
          this.notifyAccountsChanged([])
        }

        // set defaultChain upon connecting if one is requested
        const defaultNetworkId = message.data.defaultNetworkId
        if (defaultNetworkId) {
          // sets dapp network on the remote wallet, which will then notify
          // the dapp with its networks list
          await this.walletRequestHandler.setDefaultNetwork(defaultNetworkId)
        } else {
          // notify networks list
          await this.walletRequestHandler.notifyNetworks()
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

  notifyConnect(connectInfo: { chainId?: string, sessionId?: string, error?: string }) {
    const { chainId, sessionId, error } = connectInfo
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.CONNECT,
      data: {
        result: { chainId, sessionId, error }
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

  notifyWalletContext(walletContext: WalletContext) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.WALLET_CONTEXT,
      data: walletContext
    })
  }

}
