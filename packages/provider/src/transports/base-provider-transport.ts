import { EventEmitter2 as EventEmitter } from 'eventemitter2'

import {
  ProviderTransport,
  ProviderMessage,
  ProviderMessageRequest,
  EventType,
  ProviderEventTypes,
  ProviderMessageResponse,
  ProviderMessageResponseCallback,
  OpenState,
  OpenWalletIntent,
  ConnectDetails,
  WalletSession,
  ProviderRpcError,
  InitState,
  TypedEventEmitter
} from '../types'

import { NetworkConfig, WalletContext, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'
import { logger } from '@0xsequence/utils'
import { ethers } from 'ethers'

export const PROVIDER_OPEN_TIMEOUT = 30000 // in ms

let _messageIdx = 0

export const nextMessageIdx = () => ++_messageIdx

export abstract class BaseProviderTransport implements ProviderTransport {
  protected pendingMessageRequests: ProviderMessageRequest[] = []
  protected responseCallbacks = new Map<number, ProviderMessageResponseCallback>()

  protected state: OpenState
  protected confirmationOnly: boolean = false
  protected events: TypedEventEmitter<ProviderEventTypes> = new EventEmitter() as TypedEventEmitter<ProviderEventTypes>

  protected openPayload: { sessionId?: string; session?: WalletSession } | undefined
  protected connectPayload: ConnectDetails | undefined
  protected accountsChangedPayload: { accounts: string[]; origin?: string } | undefined
  protected networksPayload: NetworkConfig[] | undefined
  protected walletContextPayload: WalletContext | undefined

  protected _sessionId?: string
  protected _init: InitState
  protected _registered: boolean

  constructor() {
    this.state = OpenState.CLOSED
    this._registered = false
    this._init = InitState.NIL
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

  openWallet(path?: string, intent?: OpenWalletIntent, networkId?: string | number) {
    throw new Error('abstract method')
  }

  closeWallet() {
    throw new Error('abstract method')
  }

  isOpened(): boolean {
    return this.registered && this.state === OpenState.OPENED
  }

  isConnected(): boolean {
    // if we're registered, and we have the account details, then we are connected
    const session = this.openPayload?.session
    return (
      this.registered &&
      session !== undefined &&
      !!session.accountAddress &&
      session.accountAddress.length === 42 &&
      !!session.networks &&
      session.networks.length > 0
    )
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {
    // here, we receive the message from the dapp provider call

    if (this.state === OpenState.CLOSED) {
      // flag the wallet to auto-close once user submits input. ie.
      // prompting to sign a message or transaction
      this.confirmationOnly = true
    }

    // open/focus the wallet.
    // automatically open the wallet when a provider request makes it here.
    //
    // NOTE: if we're not signed in, then the provider will fail, users must first connect+sign in.
    //
    // TODO: how does this behave with a session has expired?
    this.openWallet(undefined, { type: 'jsonRpcRequest', method: request.method }, chainId)

    // send message request, await, and then execute callback after receiving the response
    try {
      if (!this.isOpened()) {
        await this.waitUntilOpened() // will throw on timeout
      }

      const response = await this.sendMessageRequest({
        idx: nextMessageIdx(),
        type: EventType.MESSAGE,
        data: request,
        chainId: chainId
      })
      callback(undefined, response.data)
    } catch (err) {
      callback(err)
    }
  }

  // handleMessage will handle message received from the remote wallet
  handleMessage(message: ProviderMessage<any>) {
    // init incoming for initial handshake with transport.
    // always respond to INIT messages, e.g. on popup window reload
    if (message.type === EventType.INIT) {
      logger.debug('MessageProvider, received INIT message', message)
      const { nonce } = message.data as { nonce: string }
      if (!nonce || nonce.length == 0) {
        logger.error('invalid init nonce')
        return
      }
      this._init = InitState.OK
      this.sendMessage({
        idx: -1,
        type: EventType.INIT,
        data: {
          sessionId: this._sessionId,
          nonce: nonce
        }
      })
    }

    if (this._init !== InitState.OK) {
      // if provider is not init'd, then we drop any received messages. the only
      // message we will process is of event type 'init', as our acknowledgement
      return
    }

    // message is either a notification, or its a ProviderMessageResponse
    logger.debug('RECEIVED MESSAGE FROM WALLET', message.idx, message)

    const requestIdx = message.idx
    const responseCallback = this.responseCallbacks.get(requestIdx)
    if (requestIdx) {
      this.responseCallbacks.delete(requestIdx)
    }

    // OPEN response
    //
    // Flip opened flag, and flush the pending queue
    if (message.type === EventType.OPEN && !this.isOpened()) {
      if (this._sessionId && this._sessionId !== message.data?.sessionId) {
        logger.debug('open event received from wallet, but does not match sessionId', this._sessionId)
        return
      }

      // check if open error occured due to invalid defaultNetworkId
      if (message.data?.error) {
        const err = new Error(`opening wallet failed: received ${message.data?.error}`)
        logger.error(err)
        this.close()
        throw err
      }

      // success!
      this.state = OpenState.OPENED
      this.openPayload = message.data
      this.events.emit('open', this.openPayload!)

      // flush pending requests when connected
      if (this.pendingMessageRequests.length !== 0) {
        const pendingMessageRequests = this.pendingMessageRequests.splice(0, this.pendingMessageRequests.length)

        pendingMessageRequests.forEach(async pendingMessageRequest => {
          this.sendMessage(pendingMessageRequest)
        })
      }

      return
    }

    // MESSAGE resposne
    if (message.type === EventType.MESSAGE) {
      // Require user confirmation, bring up wallet to prompt for input then close
      // TODO: perhaps apply technique like in multicall to queue messages within
      // a period of time, then close the window if responseCallbacks is empty, this is better.
      if (this.confirmationOnly) {
        setTimeout(() => {
          if (this.responseCallbacks.size === 0) {
            this.closeWallet()
          }
        }, 500) // TODO: be smarter about timer as we're processing the response callbacks..
      }

      if (!responseCallback) {
        // NOTE: this would occur if 'idx' isn't set, which should never happen
        // or when we register two handler, or duplicate messages with the same idx are sent,
        // all of which should be prevented prior to getting to this point
        throw new Error('impossible state')
      }

      // Callback to original caller
      if (responseCallback) {
        this.events.emit('message', message)
        responseCallback((message as ProviderMessageResponse).data.error, message)
        return
      }
    }

    // ACCOUNTS_CHANGED -- when a user logs in or out
    if (message.type === EventType.ACCOUNTS_CHANGED) {
      this.accountsChangedPayload = { accounts: [] }
      if (message.data && message.data.length > 0) {
        this.accountsChangedPayload = {
          accounts: [ethers.utils.getAddress(message.data[0])],
          origin: message.origin
        }
        this.events.emit('accountsChanged', this.accountsChangedPayload.accounts, this.accountsChangedPayload.origin)
      } else {
        this.events.emit('accountsChanged', [], message.origin)
      }
      return
    }

    // CHAIN_CHANGED -- when a user changes their default chain
    if (message.type === EventType.CHAIN_CHANGED) {
      this.events.emit('chainChanged', message.data)
      return
    }

    // NOTIFY NETWORKS -- when a user connects or logs in
    if (message.type === EventType.NETWORKS) {
      this.networksPayload = message.data
      this.events.emit('networks', this.networksPayload!)
      return
    }

    // NOTIFY WALLET_CONTEXT -- when a user connects or logs in
    if (message.type === EventType.WALLET_CONTEXT) {
      this.walletContextPayload = message.data
      this.events.emit('walletContext', this.walletContextPayload!)
      return
    }

    // NOTIFY CLOSE -- when wallet instructs to close
    if (message.type === EventType.CLOSE) {
      if (this.state !== OpenState.CLOSED) {
        this.close(message.data)
      }
    }

    // NOTIFY CONNECT -- when wallet instructs we've connected
    if (message.type === EventType.CONNECT) {
      this.connectPayload = message.data
      this.events.emit('connect', this.connectPayload!)
    }

    // NOTIFY DISCONNECT -- when wallet instructs to disconnect
    if (message.type === EventType.DISCONNECT) {
      if (this.isConnected()) {
        this.events.emit('disconnect', message.data)
        this.close()
      }
    }
  }

  // sendMessageRequest sends a ProviderMessageRequest over the wire to the wallet
  sendMessageRequest = async (message: ProviderMessageRequest): Promise<ProviderMessageResponse> => {
    return new Promise((resolve, reject) => {
      if ((!message.idx || message.idx <= 0) && message.type !== 'init') {
        reject(new Error('message idx not set'))
      }

      const responseCallback: ProviderMessageResponseCallback = (error: ProviderRpcError, response?: ProviderMessageResponse) => {
        if (error) {
          reject(error)
        } else if (response) {
          resolve(response)
        } else {
          throw new Error('no valid response to return')
        }
      }

      const idx = message.idx
      if (!this.responseCallbacks.get(idx)) {
        this.responseCallbacks.set(idx, responseCallback)
      } else {
        reject(new Error('duplicate message idx, should never happen'))
      }

      if (!this.isOpened()) {
        logger.debug('pushing to pending requests', message)
        this.pendingMessageRequests.push(message)
      } else {
        this.sendMessage(message)
      }
    })
  }

  sendMessage(message: ProviderMessage<any>) {
    throw new Error('abstract method')
  }

  on<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.on(event, fn as any)
  }

  once<K extends keyof ProviderEventTypes>(event: K, fn: ProviderEventTypes[K]) {
    this.events.once(event, fn as any)
  }

  emit<K extends keyof ProviderEventTypes>(event: K, ...args: Parameters<ProviderEventTypes[K]>): boolean {
    return this.events.emit(event, ...(args as any))
  }

  waitUntilOpened = async (openTimeout = PROVIDER_OPEN_TIMEOUT): Promise<WalletSession | undefined> => {
    let opened = false
    return Promise.race([
      new Promise<WalletSession | undefined>((_, reject) => {
        const timeout = setTimeout(() => {
          clearTimeout(timeout)
          // only emit close if the timeout wins the race
          if (!opened) {
            this.state = OpenState.CLOSED
            this.events.emit('close', { code: 1005, message: 'opening wallet timed out' } as ProviderRpcError)
          }
          reject(new Error('opening wallet timed out'))
        }, openTimeout)
      }),
      new Promise<WalletSession | undefined>(resolve => {
        if (this.isOpened()) {
          opened = true
          resolve(this.openPayload?.session)
          return
        }
        this.events.once('open', (openInfo: { session?: WalletSession }) => {
          this.openPayload = openInfo
          opened = true
          resolve(openInfo.session)
        })
      })
    ])
  }

  waitUntilConnected = async (): Promise<ConnectDetails> => {
    await this.waitUntilOpened()

    const connect = new Promise<ConnectDetails>(resolve => {
      if (this.connectPayload) {
        resolve(this.connectPayload)
        return
      }

      this.events.once('connect', connectDetails => {
        this.connectPayload = connectDetails
        resolve(connectDetails)
      })
    })

    const closeWallet = new Promise<ConnectDetails>((_, reject) => {
      this.events.once('close', error => {
        if (error) {
          reject(new Error(`wallet closed due to ${JSON.stringify(error)}`))
        } else {
          reject(new Error(`user closed the wallet`))
        }
      })
    })

    return Promise.race<ConnectDetails>([connect, closeWallet])
  }

  protected close(error?: ProviderRpcError) {
    if (this.state === OpenState.CLOSED) return

    this.state = OpenState.CLOSED
    this.confirmationOnly = false
    this._sessionId = undefined
    logger.info('closing wallet and flushing!')

    // flush pending requests and return error to all callbacks
    this.pendingMessageRequests.length = 0
    this.responseCallbacks.forEach(responseCallback => {
      responseCallback({
        ...new Error('wallet closed'),
        code: 4001
      })
    })
    this.responseCallbacks.clear()

    this.connectPayload = undefined
    this.openPayload = undefined
    this.accountsChangedPayload = undefined
    this.networksPayload = undefined
    this.walletContextPayload = undefined

    this.events.emit('close', error)
  }
}
