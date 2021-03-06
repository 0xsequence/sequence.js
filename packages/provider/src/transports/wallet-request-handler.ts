import EventEmitter from 'eventemitter3'

import {
  ProviderMessage, ProviderMessageRequest, ProviderMessageResponse,
  WalletMessageEvent, ProviderMessageResponseCallback,
  ProviderMessageRequestHandler,
  MessageToSign
} from '../types'

import { BigNumber, ethers } from 'ethers'
import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers'

import { Networks, NetworkConfig, JsonRpcHandler, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse } from '@0xsequence/network'

import { Signer, Account } from '@0xsequence/wallet'
import { isSignedTransactions, SignedTransactions, TransactionRequest } from '@0xsequence/transactions'

import { TypedData } from '@0xsequence/utils'
export class WalletRequestHandler implements ExternalProvider, JsonRpcHandler, ProviderMessageRequestHandler {
  private signer: Signer | null
  private prompter: WalletUserPrompter | null
  private mainnetNetworks: NetworkConfig[]
  private testnetNetworks: NetworkConfig[]

  private _defaultNetworkId?: string | number

  private events: EventEmitter<WalletMessageEvent, any> = new EventEmitter()

  constructor(signer: Signer | null, prompter: WalletUserPrompter | null, mainnetNetworks: Networks, testnetNetworks: Networks = []) {
    this.signer = signer
    this.prompter = prompter
    this.mainnetNetworks = mainnetNetworks
    this.testnetNetworks = testnetNetworks

    // if (!signer.provider) {
    //   throw new Error('wallet.provider is undefined')
    // }
  }

  async login(signer: Signer | null, mainnetNetworks: Networks = [], testnetNetworks: Networks = []) {
    this.signer = signer

    if (mainnetNetworks && mainnetNetworks.length > 0) {
      this.mainnetNetworks = mainnetNetworks
    }
    if (testnetNetworks && testnetNetworks.length > 0) {
      this.testnetNetworks = testnetNetworks
    }

    if (this._defaultNetworkId) {
      if (!(await this.setDefaultNetwork(this._defaultNetworkId, false))) {
        throw new Error(`WalletRequestHandler setup unable to set defaultNetworkId ${this._defaultNetworkId}`)
      }
    }

    this.notifyLogin(await this.signer!.getAddress())
  }

  // sendMessageRequest will unwrap the ProviderMessageRequest and send it to the JsonRpcHandler
  // (aka, the signer in this instance) and then responds with a wrapped response of
  // ProviderMessageResponse to be sent over the transport
  sendMessageRequest(message: ProviderMessageRequest): Promise<ProviderMessageResponse> {
    return new Promise(resolve => {
      this.sendAsync(message.data, (error: any, response?: JsonRpcResponse) => {
        const responseMessage: ProviderMessageResponse = {
          ...message,
          data: response!
        }

        // NOTE: we always resolve here, are the sendAsync call will wrap any exceptions
        // in the error field of the response to ensure we send back to the user
        resolve(responseMessage)

      }, message.chainId)
    })
  }

  // sendAsync implements the JsonRpcHandler interface for sending JsonRpcRequests to the wallet
  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback, chainId?: number) => {

    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: request.id!,
      result: null,
      error: null
    }

    try {

      // only allow public json rpc method to the provider when user is not logged in, aka signer is not set
      if ((!this.signer || this.signer === null) && !permittedJsonRpcMethods.includes(request.method)) {
        throw new Error(`not logged in. ${request.method} is unavailable`)
      }

      // wallet signer
      const signer = this.signer
      if (!signer) throw new Error('WalletRequestHandler: wallet signer is not configured')

      // fetch the provider for the specific chain, or undefined will select defaultChain
      const provider = await signer.getProvider(chainId)
      if (!provider) throw new Error(`WalletRequestHandler: wallet provider is not configured for chainId ${chainId}`)

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
          response.result = [walletAddress]
          break
        }

        case 'eth_getBalance': {
          const [accountAddress, blockTag] = request.params!
          const walletBalance = await provider.getBalance(accountAddress, blockTag)
          response.result = walletBalance.toHexString()
          break
        }

        case 'eth_sign': {
          // note: message from json-rpc input is in hex format
          const [signingAddress, message] = request.params!

          let sig = ''
          // TODO:
          // if (process.env.DEBUG_MODE === 'true' && this.prompter === null) {
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await signer.signMessage(ethers.utils.arrayify(message), chainId)
          } else {
            // prompt user to provide the response
            sig = await this.prompter.promptSignMessage({ chainId: chainId, message: message })
          }

          if (sig && sig.length > 0) {
            response.result = sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4': {
          // note: signingAddress from json-rpc input is in hex format, and typedDataObject
          // should be an object, but in some instances may be double string encoded
          const [signingAddress, typedDataObject] = request.params!

          let typedData: TypedData | undefined = undefined
          if (typeof(typedDataObject) === 'string') {
            try {
              typedData = JSON.parse(typedDataObject)
            } catch (e) {}
          } else {
            typedData = typedDataObject
          }

          if (!typedData || !typedData.domain || !typedData.types || !typedData.message) {
            throw new Error('invalid typedData object')
          }

          let sig = ''
          if (this.prompter === null) {
            // prompter is null, so we'll sign from here
            sig = await signer.signTypedData(typedData.domain, typedData.types, typedData.message, chainId)
          } else {
            // prompt user to provide the response
            sig = await this.prompter.promptSignMessage({ chainId: chainId, typedData: typedData })
          }

          if (sig && sig.length > 0) {
            response.result = sig
          } else {
            // The user has declined the request when value is null
            throw new Error('declined by user')
          }
          break
        }

        case 'eth_sendTransaction': {
          // https://eth.wiki/json-rpc/API#eth_sendtransaction
          const [transactionParams] = request.params!

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
          const [transaction] = request.params!
          const sender = ethers.utils.getAddress(transaction.from)

          if (sender !== await signer.getAddress()) {
            throw new Error('sender address does not match wallet')
          }

          if (this.prompter === null) {
            // The eth_signTransaction method expects a `string` return value we instead return a `SignedTransactions` object,
            // this can only be broadcasted using an RPC provider with support for signed Sequence transactions, like this one.
            // 
            // TODO: verify serializing / transporting the SignedTransaction object works as expected, most likely however
            // we will want to resolveProperties the bignumber values to hex strings
            response.result = await signer.signTransactions(transaction, chainId)
          } else {
            response.result = await this.prompter.promptSignTransaction(transaction, chainId)
          }

          break
        }

        case 'eth_sendRawTransaction': {
          // NOTE: we're not using a prompter here as the transaction is already signed
          // and would have prompted the user upon signing.

          // https://eth.wiki/json-rpc/API#eth_sendRawTransaction
          if (isSignedTransactions(request.params![0])) {
            const txChainId = BigNumber.from(request.params![0].chainId).toNumber()
            const tx = await (await signer.getRelayer(txChainId))!.relay(request.params![0])
            response.result = (await tx).hash
          } else {
            const tx = await provider.sendTransaction(request.params![0])
            response.result = tx.hash
          }
          break
        }

        case 'eth_getTransactionCount': {
          const address = ethers.utils.getAddress((request.params![0] as string))
          const tag = request.params![1]

          const walletAddress = ethers.utils.getAddress(await signer.getAddress())

          if (address === walletAddress) {
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
          response.result = await provider.getBlock(request.params![0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getBlockByHash': {
          response.result = await provider.getBlock(request.params![0] /* , jsonRpcRequest.params[1] */)
          break
        }

        case 'eth_getTransactionByHash': {
          response.result = await provider.getTransaction(request.params![0])
          break
        }

        case 'eth_call': {
          const [transactionObject, blockTag] = request.params!
          response.result = await provider.call(transactionObject, blockTag)
          break
        }

        case 'eth_getCode': {
          const [contractAddress, blockTag] = request.params!
          response.result = await provider.getCode(contractAddress, blockTag)
          break
        }

        case 'eth_estimateGas': {
          const [transactionObject] = request.params!
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
          // NOTE: must ensure that the response result below returns clean serialized data, which is to omit
          // the provider and relayer objects and only return the urls so can be reinstantiated on dapp side.
          // This is handled by this.getNetworks() but noted here for future readers.
          response.result = await this.getNetworks(true)
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

        // set default network of wallet
        case 'sequence_setDefaultNetwork': {
          const [defaultNetworkId] = request.params!
          
          if (!defaultNetworkId) {
            throw new Error('invalid request, method argument defaultNetworkId cannot be empty')
          }
          const ok = await this.setDefaultNetwork(defaultNetworkId)
          if (!ok) {
            throw new Error(`unable to set default network ${defaultNetworkId}`)
          }
      
          response.result = await this.getNetworks(true)
          break
        }

        default: {
          // NOTE: provider here will be chain-bound if chainId is provided
          const providerResponse = await provider.send(request.method, request.params!)
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

    callback(undefined, response)
  }

  on = (event: WalletMessageEvent, fn: (...args: any[]) => void) => {
    this.events.on(event, fn)
  }

  once = (event: WalletMessageEvent, fn: (...args: any[]) => void) => {
    this.events.once(event, fn)
  }

  async getAddress(): Promise<string> {
    if (!this.signer) {
      return ''
    } else {
      return this.signer.getAddress()
    }
  }

  async getChainId(): Promise<number> {
    if (!this.signer) {
      return 0
    } else {
      return this.signer.getChainId()
    }
  }

  async setDefaultNetwork(chainId: string | number, notifyNetworks: boolean = true): Promise<boolean> {
    if (!chainId) return false
    this._defaultNetworkId = chainId

    if (this.signer && (<any>this.signer).setNetworks) {
      (<any>this.signer).setNetworks(this.mainnetNetworks, this.testnetNetworks, chainId)

      if (notifyNetworks) {
        await this.notifyNetworks()
      }
      return true

    } else {
      return false
    }
  }

  get defaultNetworkId(): string | number | undefined {
    return this._defaultNetworkId
  }

  async getNetworks(jsonRpcResponse?: boolean): Promise<NetworkConfig[]> {
    if (!this.signer) {
      console.warn('signer not set: getNetworks is returning an empty list')
      return []
    }

    const networks = await this.signer.getNetworks()

    if (jsonRpcResponse) {
      // omit provider and relayer objects as they are not serializable
      return networks.map(n => {
        const network: NetworkConfig = { ...n }
        network.provider = undefined
        network.relayer = undefined
        return network
      })
    } else {
      return networks
    }
  }

  notifyLogin(accountAddress: string) {
    if (!accountAddress || accountAddress.length === 0) {
      this.events.emit('accountsChanged', [])
    } else {
      this.events.emit('accountsChanged', [accountAddress])
    }
    this.notifyNetworks()
    this.notifyWalletContext()
  }

  notifyLogout() {
    this.events.emit('accountsChanged', [])
    this.events.emit('networks', [])
  }

  async notifyNetworks(networks?: NetworkConfig[]) {
    const n = networks || await this.getNetworks(true)
    this.events.emit('networks', n)
    if (n && n.length > 0) {
      this.events.emit('chainChanged', ethers.utils.hexlify(n[0].chainId))
    } else {
      this.events.emit('chainChanged', '0x0')
    }
  }

  async notifyWalletContext() {
    if (!this.signer) {
      console.warn('signer not set: skipping to notify wallet context')
      return
    }
    const walletContext = await this.signer.getWalletContext()
    this.events.emit('walletContext', walletContext)
  }

  getSigner(): Signer | null {
    return this.signer
  }

  setSigner(signer: Signer | null) {
    this.signer = signer
  }
}

export interface WalletUserPrompter {
  // TODO: remove appAuth?: boolean ..? doesnt seem to be used, and MessageToSign has all the details.
  promptSignMessage(message: MessageToSign, appAuth?: boolean): Promise<string>

  promptSignTransaction(txn: TransactionRequest, chaindId?: number): Promise<string>
  promptSendTransaction(txn: TransactionRequest, chaindId?: number): Promise<string>
}

const permittedJsonRpcMethods = [
  'net_version', 'eth_chainId', 'eth_getBalance', 'eth_getTransactionCount',
  'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getTransactionByHash',
  'eth_getCode', 'eth_estimateGas', 'eth_gasPrice',

  'sequence_getWalletContext', 'sequence_getNetworks', 'sequence_setDefaultNetwork'
]
