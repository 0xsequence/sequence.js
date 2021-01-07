import EventEmitter from 'eventemitter3'

import {
  ProviderMessage, ProviderMessageRequest, ProviderMessageResponse,
  WalletMessageEvent, ProviderMessageResponseCallback,
  ProviderMessageRequestHandler,
  MessageToSign
} from './types'

import { BigNumber, ethers } from 'ethers'
import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers'
import { TypedDataUtils } from 'ethers-eip712'

import { Networks, NetworkConfig, JsonRpcHandler, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'

import { Signer } from '@0xsequence/wallet'
import { isSignedTransactions } from '@0xsequence/transactions'

export class WalletRequestHandler implements ExternalProvider, JsonRpcHandler, ProviderMessageRequestHandler {
  private signer: Signer
  private prompter: WalletUserPrompter
  private networks: Networks
  private events: EventEmitter<WalletMessageEvent, any> = new EventEmitter()

  constructor(signer: Signer, prompter: WalletUserPrompter, networks: Networks) {
    this.signer = signer
    this.prompter = prompter
    this.networks = networks

    if (!signer.provider) {
      throw new Error('wallet.provider is undefined')
    }
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
    const signer = this.signer
    if (!signer) throw new Error('WalletRequestHandler: wallet signer is not configured')

    // fetch the provider for the specific chain, or undefined will select MainChain
    const provider = await signer.getProvider(chainId)
    if (!provider) throw new Error(`WalletRequestHandler: wallet provider is not configured for chainId ${chainId}`)

    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: null,
      error: null
    }
    
    try {
      switch (request.method) {

        case 'net_version': {
          const result = await provider.send('net_version', [])
          response.result = result
          break
        }

        case 'eth_chainId': {
          const result = await provider.send('eth_chainId', [])
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
          const walletBalance = await provider.getBalance(accountAddress, blockTag)
          response.result = walletBalance.toHexString()
          break
        }

        case 'eth_sign': {
          // note: message from json-rpc input is in hex format
          const [signingAddress, message] = request.params

          let sig = ''
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await signer.signMessage(ethers.utils.arrayify(message), chainId)
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

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4': {
          console.log("ahhhhhhhhhhhhhhhhhhhhh")
          console.log(request)
          console.log(chainId)

          // note: message from json-rpc input is in hex format
          const [signingAddress, typedDataString] = request.params

          let typedData: any = {}
          try {
            typedData = JSON.parse(typedDataString)
          } catch (e) {}

          console.log(typedData)
          console.log('?? typeof?', typeof(typedData))

          let sig = ''
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            // TODO: use ethers eip712 impl.
            sig = await signer.signTypedData(typedData.domain, typedData.types, typedData.message) //, chainId)
          } else {
            // prompt user to provide the response
            sig = await this.prompter.promptSignMessage({ chainId: chainId, typedData: typedData })
          }

          console.log('=======> sig', sig)

          if (sig.length > 0) {
            response.result = sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_sendTransaction': {
          // https://eth.wiki/json-rpc/API#eth_sendtransaction
          const [transactionParams] = request.params

          let txnHash = ''
          if (this.prompter === null) {
            // prompter is null, so we'll send from here
            const txnResponse = await signer.sendTransaction(transactionParams, chainId)
            txnHash = txnResponse.hash
          } else {
            // prompt user to provide the response
            txnHash = await this.prompter.promptSendTransaction(transactionParams, chainId)
          }

          if (txnHash) {
            response.result = txnHash
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_signTransaction': {
          // https://eth.wiki/json-rpc/API#eth_signTransaction
          const [transaction] = request.params
          const sender = ethers.utils.getAddress(transaction.from)

          // TODO: use prompter

          if (this.prompter === null) {
            // ...
          }

          if (sender === await signer.getAddress()) {
            // The eth_signTransaction method expects a `string` return value we instead return a `SignedTransactions` object,
            // this can only be broadcasted using an RPC provider with support for signed Sequence transactions, like this one.
            response.result = await signer.signTransactions(transaction, chainId)
          } else {
            throw new Error('sender address does not match wallet')
          }

          break
        }

        case 'eth_sendRawTransaction': {
          // https://eth.wiki/json-rpc/API#eth_sendRawTransaction
          if (isSignedTransactions(request.params[0])) {
            const txChainId = BigNumber.from(request.params[0].chainId).toNumber()
            const tx = await (await signer.getRelayer(txChainId)).relay(request.params[0])
            response.result = (await tx).hash
          } else {
            response.result = await provider.sendTransaction(request.params[0])
          }
          break
        }

        case 'eth_getTransactionCount': {
          const address = (request.params[0] as string).toLowerCase()
          const tag = request.params[1]

          const walletAddress = await signer.getAddress()

          if (address === walletAddress.toLowerCase()) {
            const count = await signer.getTransactionCount(tag)
            response.result = ethers.BigNumber.from(count).toHexString()
          } else {
            const count = await provider.getTransactionCount(address, tag)
            response.result = ethers.BigNumber.from(count).toHexString()
          }
          break
        }

        case 'eth_blockNumber': {
          response.result = await provider.getBlockNumber()
          break
        }

        case 'eth_getBlockByNumber': {
          response.result = await provider.getBlock(request.params[0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getBlockByHash': {
          response.result = await provider.getBlock(request.params[0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getTransactionByHash': {
          response.result = await provider.getTransaction(request.params[0])
          break
        }

        case 'eth_call': {
          const [transactionObject, blockTag] = request.params
          response.result = await provider.call(transactionObject, blockTag)
          break
        }

        case 'eth_getCode': {
          const [contractAddress, blockTag] = request.params
          response.result = await provider.getCode(contractAddress, blockTag)
          break
        }

        case 'eth_estimateGas': {
          const [transactionObject] = request.params
          response.result = await provider.estimateGas(transactionObject)
          break
        }

        case 'eth_gasPrice': {
          const gasPrice = await provider.getGasPrice()
          response.result = gasPrice.toHexString()
          break
        }

        // smart wallet method
        case 'sequence_getWalletContext': {
          response.result = await signer.getWalletContext()
          break
        }

        // smart wallet method
        case 'sequence_getWalletConfig': {
          response.result = await signer.getWalletConfig(chainId)
          break
        }

        // smart wallet method
        case 'sequence_getWalletState': {
          response.result = await signer.getWalletState(chainId)
          break
        }

        // smart wallet method
        case 'sequence_getNetworks': {
          response.result = await signer.getNetworks()
          break
        }

        // smart wallet method
        case 'sequence_updateConfig': {
          throw new Error('sequence_updateConfig method is not allowed from a dapp')
          // NOTE: method is disabled as we don't need a dapp to request to update a config.
          // However, if we ever want this, we can enable it but must also use the prompter
          // for confirmation.
          //
          // const [newConfig] = request.params
          // response.result = await signer.updateConfig(newConfig)
          break
        }

        // smart wallet method
        case 'sequence_publishConfig': {
          throw new Error('sequence_publishConfig method is not allowed from a dapp')
          break
        }

        // relayer method
        case 'sequence_estimateGasLimits': {
          // TODO
          break
        }

        // relayer method
        case 'sequence_gasRefundOptions': {
          // TODO
          break
        }

        // relayer method
        case 'sequence_getNonce': {
          // TODO
          break
        }

        // relayer method
        case 'sequence_relay': {
          // TODO
          break
        }

        default: {
          // NOTE: provider here will be chain-bound if chainId is provided
          const providerResponse = await provider.send(request.method, request.params)
          response.result = providerResponse
        }
      }

    } catch (err) {
      console.error(err)

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

  on = (event: WalletMessageEvent, fn: (...args: any[]) => void) => {
    this.events.on(event, fn)
  }

  once = (event: WalletMessageEvent, fn: (...args: any[]) => void) => {
    this.events.once(event, fn)
  }

  getAddress(): Promise<string> {
    return this.signer.getAddress()
  }

  getChainId(): Promise<number> {
    return this.signer.getChainId()
  }

  async getNetwork(): Promise<NetworkConfig> {
    const chainId = await this.getChainId()

    const chainIds = []
    const networkConfig = this.networks.find(config => {
      if (config.chainId === chainId) {
        return config
      }
      chainIds.push(config.chainId)
    })

    if (!networkConfig) {
      throw new Error(`NetworkConfig with chainId ${chainId} could not be found in list: ${chainIds}.`)
    }
    return networkConfig
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
  promptSignTransaction(txnParams: any, chaindId?: number): Promise<string>
  promptSendTransaction(txnParams: any, chaindId?: number): Promise<string>
}
