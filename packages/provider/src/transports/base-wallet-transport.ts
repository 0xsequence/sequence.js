import { ethers } from 'ethers'
import {
  WalletTransport, ProviderMessage, ProviderMessageRequest,
  ProviderMessageType, ProviderMessageResponse, ProviderMessageTransport,
  ProviderConnectInfo, ProviderRpcError, InitState, ConnectDetails
} from '../types'

import { WalletRequestHandler } from './wallet-request-handler'

import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'
import { logger } from '@0xsequence/utils'

export abstract class BaseWalletTransport implements WalletTransport {

  protected walletRequestHandler: WalletRequestHandler
  protected _sessionId: string
  protected _registered: boolean
  protected _init: InitState

  constructor(walletRequestHandler: WalletRequestHandler) {
    this.walletRequestHandler = walletRequestHandler
    this._init = InitState.NIL

    this.walletRequestHandler.on('connect', (connectInfo: any) => {
      if (!this.registered) return
      // means user has logged in and wallet is connected to the app
      this.notifyConnect(connectInfo)
    })

    this.walletRequestHandler.on('disconnect', (error?: ProviderRpcError) => {
      if (!this.registered) return
      // means user has logged out the app / disconnected wallet from the app
      this.notifyDisconnect(error)
    })

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

      case ProviderMessageType.OPEN: {
        if (this._init !== InitState.OK) return
        const { defaultNetworkId } = request.data
        this.open(defaultNetworkId)
        return
      }

      // case ProviderMessageType.CLOSE: {
      //   if (this._init !== InitState.OK) return
      //   // we echo back to close, confirming wallet close request
      //   this.notifyClose()
      //   return
      // }

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
        logger.error(`unexpected payload type ${request.type}`)
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

  notifyOpen(openInfo: { chainId?: string, sessionId?: string, error?: string }) {
    const { chainId, sessionId, error } = openInfo
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.OPEN,
      data: {
        chainId, sessionId, error
      }
    })
  }

  notifyAuthorized(connectDetails: ConnectDetails) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.AUTHORIZED,
      data: {
        ...connectDetails
      }
    })
  }

  notifyClose() {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.CLOSE,
      data: null
    })
  }

  notifyConnect(connectInfo: ProviderConnectInfo & { error?: string }) {
    const { chainId, error } = connectInfo
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.CONNECT,
      data: {
        chainId, error
      }
    })
  }

  notifyDisconnect(error?: ProviderRpcError) {
    this.sendMessage({
      idx: -1,
      type: ProviderMessageType.DISCONNECT,
      data: error
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

  protected open = async (defaultNetworkId?: string | number): Promise<boolean> => {
    let loggedIn = false
    const accountAddress = await this.walletRequestHandler.getAddress()
    if (accountAddress && accountAddress.startsWith('0x') && accountAddress.length === 42) {
      loggedIn = true
    }

    if (!loggedIn) {
      // open wallet without a specific connected chainId, as the user is not logged in
      this.notifyOpen({
        sessionId: this._sessionId
      })
      // this.notifyAccountsChanged([])
      return true
    }

    // account is logged in, lets return chainId information
    let chainId: number | undefined = undefined
    try {
      if (defaultNetworkId) {
        chainId = await this.walletRequestHandler.setDefaultNetwork(defaultNetworkId, false)
      } else {
        chainId = await this.walletRequestHandler.getChainId()
      }
    } catch (err) {
    }

    // failed to set default network or open
    if (!chainId || chainId <= 0) {
      this.notifyOpen({
        sessionId: this._sessionId,
        error: `failed to open wallet on network ${defaultNetworkId}`
      })
      return false
    }

    // successfully opened wallet to the default network
    this.notifyOpen({
      chainId: `${chainId}`,
      sessionId: this._sessionId
    })

    // notify wallet context each time wallet is opened, to ensure latest
    // context is always provided
    await this.walletRequestHandler.notifyWalletContext()
  
    // notify networks
    await this.walletRequestHandler.notifyNetworks()

    // notify account address
    this.notifyAccountsChanged([accountAddress])

    // notify connect
    // NOTE: we don't send 'connect' event to app from here, as it's handled
    // by the WalletRequestHandler as it may occur outside of the open() call in
    // certain cases (ie. wallet opens which isnt logged in, then signs in after)
 
    return true
  }
}
