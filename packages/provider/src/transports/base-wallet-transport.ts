import { ethers } from 'ethers'
import {
  WalletTransport, ProviderMessage, ProviderMessageRequest,
  EventType, ProviderMessageResponse, ProviderMessageTransport,
  ProviderRpcError, InitState, ConnectDetails, OpenWalletIntent, WalletSession
} from '../types'

import { WalletRequestHandler } from './wallet-request-handler'

import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'
import { logger, sanitizeAlphanumeric, sanitizeHost } from '@0xsequence/utils'

export abstract class BaseWalletTransport implements WalletTransport {

  protected walletRequestHandler: WalletRequestHandler
  protected _sessionId: string
  protected _registered: boolean
  protected _init: InitState

  // parentOrigin identifies the dapp's origin which opened the app. A transport
  // will auto-detect and set this value if it can.
  protected parentOrigin?: string

  constructor(walletRequestHandler: WalletRequestHandler) {
    this.walletRequestHandler = walletRequestHandler
    this._init = InitState.NIL

    this.walletRequestHandler.on('connect', (connectDetails: ConnectDetails) => {
      if (!this.registered) return
      // means user has logged in and wallet is connected to the app
      this.notifyConnect(connectDetails)
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

    this.walletRequestHandler.on('close', (error?: ProviderRpcError) => {
      if (!this.registered) return
      this.notifyClose(error)
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

      case EventType.OPEN: {
        if (this._init !== InitState.OK) return
        const { intent, networkId } = request.data
        await this.open(intent, networkId)
        return
      }

      // case ProviderMessageType.CLOSE: {
      //   if (this._init !== InitState.OK) return
      //   // we echo back to close, confirming wallet close request
      //   this.notifyClose()
      //   return
      // }

      case EventType.MESSAGE: {
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

  notifyOpen(openInfo: { chainId?: string, sessionId?: string, session?: WalletSession, error?: string }) {
    const { chainId, sessionId, session, error } = openInfo
    this.sendMessage({
      idx: -1,
      type: EventType.OPEN,
      data: {
        chainId, sessionId, session, error
      }
    })
  }

  notifyClose(error?: ProviderRpcError) {
    this.sendMessage({
      idx: -1,
      type: EventType.CLOSE,
      data: error
    })
  }

  notifyConnect(connectDetails: ConnectDetails) {
    this.sendMessage({
      idx: -1,
      type: EventType.CONNECT,
      data: connectDetails
    })
  }

  notifyDisconnect(error?: ProviderRpcError) {
    this.sendMessage({
      idx: -1,
      type: EventType.DISCONNECT,
      data: error
    })
  }

  notifyAccountsChanged(accounts: string[]) {
    this.sendMessage({
      idx: -1,
      type: EventType.ACCOUNTS_CHANGED,
      data: accounts
    })
  }

  notifyChainChanged(chainIdHex: string) {
    this.sendMessage({
      idx: -1,
      type: EventType.CHAIN_CHANGED,
      data: chainIdHex
    })
  }

  notifyNetworks(networks: NetworkConfig[]) {
    this.sendMessage({
      idx: -1,
      type: EventType.NETWORKS,
      data: networks
    })
  }

  notifyWalletContext(walletContext: WalletContext) {
    this.sendMessage({
      idx: -1,
      type: EventType.WALLET_CONTEXT,
      data: walletContext
    })
  }

  protected open = async (intent?: OpenWalletIntent, networkId?: string | number): Promise<boolean> => {

    // TODO: should we move the .init() method to this class and call it from here..? possibly..

    // Prepare connect options from intent
    if (intent && intent.type === 'connect' && intent.options) {
      const connectOptions = intent.options

      // TODO: review/remove..
      // console.log('.weeeeeeeeeeee......! parentorigin', this.parentOrigin)
      // console.log('origin from options..,', connectOptions.origin)

      // Sanity/integrity check the intent payload
      // TODO: update .........
      // if (this.parentOrigin && connectOptions.origin) {
      //   if (connectOptions.origin !== this.parentOrigin) {
      //     throw new Error('origin is invalid')
      //   } else {
      //     // set connectOptions origin to the parentOrigin determined by the transport
      //     connectOptions.origin = this.parentOrigin
      //   }
      // } else if (!this.parentOrigin && connectOptions.origin) {
      //   connectOptions.origin = sanitizeHost(connectOptions.origin)
      // }
      if (connectOptions.app) {
        connectOptions.app = sanitizeAlphanumeric(connectOptions.app)
      }

      // Set connect options on the walletRequestHandler as our primary
      // wallet controller
      this.walletRequestHandler.setConnectOptions(connectOptions)
      if (connectOptions.networkId) {
        networkId = connectOptions.networkId
      }

    } else {
      this.walletRequestHandler.setConnectOptions(undefined)
    }

    // Notify open and proceed to prompt for connection if intended
    if (!this.walletRequestHandler.isSignedIn()) {

      // open wallet without a specific connected chainId, as the user is not signed in
      this.notifyOpen({
        sessionId: this._sessionId
      })
      return true

    } else {

      // Set default network, in case of error chainId will be undefined or 0
      let chainId: number | undefined = undefined
      try {
        if (networkId) {
          chainId = await this.walletRequestHandler.setDefaultNetwork(networkId, false)
        } else {
          chainId = await this.walletRequestHandler.getChainId()
        }
      } catch (err) {
      }

      // Failed to set default network on open -- quit + close
      if (!chainId || chainId <= 0) {
        this.notifyOpen({
          sessionId: this._sessionId,
          error: `failed to open wallet on network ${networkId}`
        })
        return false
      }

      // prompt user with a connect request. the options will be used as previously set above.
      // upon success, the walletRequestHandler will notify the dapp with the ConnectDetails.
      // upon cancellation by user, the walletRequestHandler will throw an error

      if (intent && intent.type === 'connect') {
        
        // notify wallet is opened, without session details
        this.notifyOpen({
          sessionId: this._sessionId
        })

        const connectDetails = await this.walletRequestHandler.promptConnect()
        this.walletRequestHandler.notifyConnect(connectDetails)

        // auto-close by default, unless intent is to keep open
        if (!intent.options || intent.options.keepWalletOpened !== true) {
          this.notifyClose()
        }

      } else {

        // user is already connected, notify session details.
        // TODO: in future, keep list if 'connected' dapps / sessions in the session
        // controller, and only sync with allowed apps
        this.notifyOpen({
          sessionId: this._sessionId,
          chainId: `${chainId}`,
          session: await this.walletRequestHandler.walletSession()
        })  

      }
    }
    
    return true
  }
}
