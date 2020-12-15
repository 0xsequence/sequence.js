import EventEmitter from 'eventemitter3'

import {
  ProviderMessage, ProviderMessageRequest, ProviderMessageResponse,
  WalletMessageEvent, ProviderMessageResponseCallback,
  ProviderMessageRequestHandler,
  MessageToSign
} from './types'

import { ethers, Signer as AbstractSigner } from 'ethers'
import { JsonRpcProvider, ExternalProvider, TransactionResponse } from '@ethersproject/providers'
import { TypedDataUtils } from 'ethers-eip712'

import { Networks, NetworkConfig, JsonRpcHandler, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'

import { Wallet } from '@0xsequence/wallet'
import { SequenceTransaction, appendNonce, readSequenceNonce, toSequenceTransactions, isSequenceTransaction, flattenAuxTransactions } from '@0xsequence/transactions'

export class WalletRequestHandler implements ExternalProvider, JsonRpcHandler, ProviderMessageRequestHandler {
  private wallet: AbstractSigner // TODO: should be WalletSigner | AbstractSigner
  private provider: JsonRpcProvider
  private prompter: WalletUserPrompter
  private networks: Networks
  private events: EventEmitter<WalletMessageEvent, any> = new EventEmitter()

  // TODO: should be WalletSigner | AbstractSigner
  constructor(wallet: AbstractSigner, provider: JsonRpcProvider, prompter: WalletUserPrompter, networks: Networks) {
    this.wallet = wallet.connect(provider)
    this.provider = provider
    this.prompter = prompter
    this.networks = networks
  }

  // sendMessageRequest will unwrap the ProviderMessageRequest and send it to the JsonRpcHandler
  // (aka, the signer in this instance) and then responds with a wrapped response of
  // ProviderMessageResponse to be sent over the transport
  sendMessageRequest(message: ProviderMessageRequest): Promise<ProviderMessageResponse> {
    return new Promise((resolve, reject) => {

      this.sendAsync(message.data, (error: any, response?: JsonRpcResponse) => {
        const responseMessage: ProviderMessageResponse = {
          ...message,
          data: response
        }

        // TODO: we're not doing anything with error here, this is when the Wallet
        // sendAsync returns an error / blows up, we should throw to the wallet-app
        // but we should also respond with the error so it knows something went wrong.
        // We can either form a JsonRpcResponse ourselves with the error code..
        // (probably), or add a type on ProviderMessage<T>

        resolve(responseMessage)
      })
    })
  }

  // sendAsync implements the JsonRpcHandler interface for sending JsonRpcRequests to the wallet
  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

    // TODO/XXX
    // TODO: throwing, but we must also call the "callback" with the error here..
    const signer = this.wallet
    if (!signer) throw Error('WalletRequestHandler: wallet is not configured')

    const provider = this.provider
    if (!provider) throw Error('WalletRequestHandler: wallet provider is not configured')

    if (!chainId) {
      chainId = await this.wallet.getChainId()
    }

    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: null,
      error: null
    }
    
    try {
      switch (request.method) {

        case 'net_version': {
          const result = await this.provider.send('net_version', [])
          response.result = result
          break
        }

        case 'eth_chainId': {
          const result = await this.provider.send('eth_chainId', [])
          response.result = result
          break
        }

        case 'eth_accounts': {
          const walletAddress = await signer.getAddress()
          response.result = [walletAddress.toLowerCase()]
          break
        }

        case 'eth_getBalance': {
          const [accountAddress, blockTag] = request.params
          const walletBalance = await this.provider.getBalance(accountAddress, blockTag)
          response.result = walletBalance.toHexString()
          break
        }

        case 'eth_sign': {
          // note: message from json-rpc input is in hex format
          const [signingAddress, message] = request.params

          let sig = ''
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await this.wallet.signMessage(ethers.utils.arrayify(message))//, chainId)
          } else {
            // prompt user to provide the response
            sig = await this.prompter.promptSignMessage({ chainId: chainId, message: message })
          }

          if (sig.length > 0) {
            response.result = sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_signTypedData': {
          // note: message from json-rpc input is in hex format
          const [signingAddress, typedData] = request.params

          let sig = ''
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            const digest = TypedDataUtils.encodeDigest(typedData)
            sig = await this.wallet.signMessage(ethers.utils.arrayify(digest))//, chainId)
          } else {
            // prompt user to provide the response
            sig = await this.prompter.promptSignMessage({ chainId: chainId, typedData: typedData })
          }

          if (sig.length > 0) {
            response.result = sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
        }

        case 'eth_sendTransaction': {
          const [transactionParams] = request.params

          // Prompt the user to confirm the signing request
          const txnResponse = await this.prompter.promptSendTransaction(transactionParams, chainId)

          if (txnResponse) {
            response.result = txnResponse
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }

          break
        }

        case 'eth_signTransaction': {
          throw Error('TODO')
          // const transaction = request.params[0]
          // const sender = transaction.from.toLowerCase()

          // if (sender === this.wallet.address.toLowerCase()) {
          //   let stxs = await toSequenceTransactions(this.wallet, [transaction])
          //   if (readSequenceNonce(...stxs) === undefined) {
          //     stxs = appendNonce(stxs, await this.wallet.getNonce())
          //   }

          //   const sig = await this.wallet.signTransactions(stxs)
          //   response.result = {
          //     raw: sig,
          //     tx: stxs.length === 1
          //       ? stxs[0]
          //       : {
          //           ...stxs[0],
          //           auxiliary: stxs.slice(1)
          //         }
          //   }
          // } else {
          //   throw Error('sender address does not match wallet')
          // }
        }

        case 'eth_sendRawTransaction': {
          throw Error('TODO')
          // const signature = request.params[0].raw
          // const transaction = request.params[0].tx

          // let tx: Promise<TransactionResponse>

          // if (isSequenceTransaction(transaction)) {
          //   const stx = flattenAuxTransactions([transaction])
          //   tx = this.wallet.relayer.relay(this.wallet.config, this.wallet.context, signature, ...(stx as SequenceTransaction[]))
          // }

          // if (tx) {
          //   response.result = (await tx).hash
          // }
        }

        case 'eth_blockNumber': {
          response.result = await this.provider.getBlockNumber()
          break
        }

        case 'eth_getBlockByNumber': {
          response.result = await this.provider.getBlock(request.params[0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getBlockByHash': {
          response.result = await this.provider.getBlock(request.params[0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getTransactionByHash': {
          response.result = await this.provider.getTransaction(request.params[0])
          break
        }

        case 'eth_call': {
          const [transactionObject, blockTag] = request.params

          response.result = await this.provider.call(transactionObject, blockTag)
          break
        }

        case 'eth_getCode': {
          const [contractAddress, blockTag] = request.params
          response.result = await this.provider.getCode(contractAddress, blockTag)
          break
        }

        case 'eth_estimateGas': {
          const [transactionObject] = request.params
          response.result = await this.provider.estimateGas(transactionObject)
          break
        }

        case 'eth_gasPrice': {
          const gasPrice = await this.provider.getGasPrice()
          response.result = gasPrice.toHexString()
          break
        }

        case 'eth_getTransactionCount': {
          throw Error('TODO')
          // const address = (request.params[0] as string).toLowerCase()
          // const tag = request.params[1]

          // if (address === this.wallet.address.toLowerCase()) {
          //   const count = await this.wallet.getTransactionCount(tag)
          //   response.result = ethers.BigNumber.from(count).toHexString()
          // } else {
          //   const count = await this.provider.getTransactionCount(address, tag)
          //   response.result = ethers.BigNumber.from(count).toHexString()
          // }
        }

        default: {
          // const providerResponse = await this.provider.send(request.method, request.params)
          // response.result = providerResponse
          throw new Error(`Provider does not implement method '${request.method}'. Check with https://support.sequence.build`)
        }
      }

    } catch (err) {
      // TODO/XXX: error messages
      // See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1193.md#rpc-errors
      response.result = null
      response.error = {
        code: 4001,
        data: `${err}`
      }
    }

    callback(null, response)
  }

  // private sendRawTransaction
  // etc..

  on = (event: WalletMessageEvent, fn: (...args: any[]) => void) => {
    this.events.on(event, fn)
  }

  once = (event: WalletMessageEvent, fn: (...args: any[]) => void) => {
    this.events.once(event, fn)
  }

  getAddress(): Promise<string> {
    return this.wallet.getAddress()
  }

  getChainId(): Promise<number> {
    return this.wallet.getChainId()
  }

  async getNetwork(): Promise<NetworkConfig> {
    const chainId = await this.getChainId()

    Object.values(this.networks).find(config => {
      if (config.chainId === chainId) {
        return config
      }
    })

    throw Error(`NetworkConfig with chainId ${chainId} could not be found.`)
  }

  notifyNetwork(network: NetworkConfig) {
    this.events.emit('network', network)
    // TODO: check/confirm this is correct..
    this.events.emit('chainChanged', ethers.utils.hexlify(network.chainId))
  }

  notifyLogin(accountAddress: string) {
    this.events.emit('login', accountAddress)
    this.events.emit('accountsChanged', [accountAddress])
  }

  notifyLogout() {
    this.events.emit('logout')
  }
}

export interface WalletUserPrompter {
  promptSignMessage(message: MessageToSign, appAuth?: boolean): Promise<string>
  promptSendTransaction(txnParams: any, chaindId?: number): Promise<string>
}
