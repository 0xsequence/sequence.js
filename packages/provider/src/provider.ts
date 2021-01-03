import { ethers } from 'ethers'
import { BytesLike } from '@ethersproject/bytes'
import { Web3Provider as EthersWeb3Provider, ExternalProvider, TransactionRequest, TransactionResponse, JsonRpcProvider, Networkish } from "@ethersproject/providers"
import { TypedDataDomain, TypedDataField, TypedDataSigner } from '@ethersproject/abstract-signer'
import { _TypedDataEncoder } from '@ethersproject/hash'
import { NetworkConfig, Networks, WalletContext, ChainId, JsonRpcHandler, JsonRpcHandlerFunc, JsonRpcFetchFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse, maybeNetworkId } from '@0xsequence/network'
import { Signer, WalletConfig, WalletState } from '@0xsequence/wallet'
import { Relayer } from '@0xsequence/relayer'
import { Deferrable } from '@0xsequence/utils'
import { Transactionish, SignedTransactions } from '@0xsequence/transactions'
import { WalletRequestHandler } from './wallet-request-handler'

// naming..?
// Web3Provider, Web3Signer, Web3Relayer
//
//.. or.... SequenceProvider, SequenceSigner, SequenceRelayer
//

// for WalletProvider..:
// hmm.. later, we'll need to be able to target a specific network..
// for logs, transactions, etc.....
// even our cache needs to be multi-network
//
// a dapp will want to set it's "primary" network, default to one of the networks
// but, still access others, including the auth chain, etc..
//
// lets setup e2e tests with concurrently to have 2 hardhat servers with different ids


//----

// SequenceProvider
// SequenceSigner 
// ..? or just Provider and Signer ..? or.. Web3Provider, etc..?

export class Web3Provider extends EthersWeb3Provider implements JsonRpcHandler {

  // or could be just as an integrity check, for context we're expecting?
  // TODO: new methods... sequence_getWalletContext   .. sequence_getWalletConfig
  // etc........

  // also, make to separate util method
  // static isSequenceProvider(cand: any): cand is Web3Provider {
  // }

  // chainId is the default chainId to use with requests, but may be overridden
  // by passing chainId argument to specific method
  readonly defaultChainId?: number

  constructor(provider: JsonRpcHandler | JsonRpcFetchFunc, defaultChainId?: ChainId) {
    if (typeof(provider) === 'function') {
      super(provider, 'any')
    } else {
      const jsonRpcFetchFunc = (method: string, params?: Array<any>, chainId?: number): Promise<any> => {
        return new Promise((resolve, reject) => {
          // TODO: pass id and jsonrpc fields..? or will be auto-assigned?
          provider.sendAsync({ method, params }, (error: any, response?: JsonRpcResponse) => {
            if (error) {
              reject(error)
            } else {
              resolve(response.result)
            }
          }, chainId)
        })
      }
      super(jsonRpcFetchFunc, 'any')
    }

    this.defaultChainId = maybeNetworkId(defaultChainId)
  }

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback | ((error: any, response: any) => void), chainId?: number) {
    this.send(request.method, request.params, chainId).then(r => {
      callback(undefined, {
        jsonrpc: '2.0',
        id: request.id,
        result: r
      })
    }).catch(e => callback(e, undefined))
  }

  send(method: string, params: Array<any>, chainId?: number): Promise<any> {
    const jsonRpcFetchFunc = this.jsonRpcFetchFunc as JsonRpcFetchFunc
    return jsonRpcFetchFunc(method, params, chainId || this.defaultChainId)
  }

  getSigner(): Web3Signer {
    return new Web3Signer(this, this.defaultChainId)
  }
}

export class LocalWeb3Provider extends Web3Provider {
  constructor(signer: Signer, networks: Networks) {
    const walletRequestHandler = new WalletRequestHandler(signer, null, networks)
    super(walletRequestHandler)
  }
}

export class Web3Signer extends Signer implements TypedDataSigner {
  readonly provider: Web3Provider
  readonly defaultChainId?: number

  constructor(provider: Web3Provider, defaultChainId?: number) {
    super()
    this.provider = provider
    this.defaultChainId = defaultChainId
  }

  _address: string
  _index: number
  _context: WalletContext
  _networks: NetworkConfig[]

  //
  // ethers AbstractSigner methods
  //

  async getAddress(): Promise<string> {
    if (this._address) return this._address
    const accounts = await this.provider.send('eth_accounts', [])
    this._address = accounts[0]
    this._index = 0
    return this._address
  }

  signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('signing transactions is unsupported')
  }

  connect(provider: ethers.providers.Provider): ethers.providers.JsonRpcSigner {
    throw new Error('unsupported: cannot alter JSON-RPC Signer connection')
  }

  //
  // Sequence Signer methods
  //

  async getProvider(chainId?: number): Promise<JsonRpcProvider | undefined> {
    // chainId is ignored here
    return this.provider
  }

  getRelayer(chainId?: number): Promise<Relayer | undefined> {
    // hmmmmmm... JsonRpcRelayer ......? or, Web3Relayer.. or SequenceRelayer?

    // sequence_estimateGasLimits
    // sequence_gasRefundOptions
    // sequence_getNonce
    // sequence_relay

    throw new Error('TODO')
  }

  async getWalletContext(): Promise<WalletContext> {
    if (!this._context) {
      this._context = await this.provider.send('sequence_getWalletContext', [])
    }
    return this._context
  }

  async getWalletConfig(chainId?: ChainId): Promise<WalletConfig[]> {
    return await this.provider.send('sequence_getWalletConfig', [], maybeNetworkId(chainId) || this.defaultChainId)
  }

  async getWalletState(chainId?: ChainId): Promise<WalletState[]> {
    return await this.provider.send('sequence_getWalletState', [], maybeNetworkId(chainId) || this.defaultChainId)
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    if (!this._networks) {
      this._networks = await this.provider.send('sequence_getNetworks', [])
    }
    return this._networks
  }

  getSigners(chainId?: ChainId): Promise<string[]> {
    // first sequence_getNetworks
    // find the auth chain, etc........?

    // call, sequence_getWalletConfig
    // .. passing the authChain ..?

    // and then get list of signers
    throw new Error('TODO')
  }

  signMessage(message: BytesLike, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    // TODO: use classic method.. but, pass extra options..?
    throw new Error('TODO')
  }

  // TODO: we need a way to pass chainId here too..
  // our provider send has extra things we can send, lets use it..
  async signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    // Populate any ENS names (in-place)
    const populated = await _TypedDataEncoder.resolveNames(domain, types, value, (name: string) => {
      return this.provider.resolveName(name)
    })

    const address = await this.getAddress()

    return await this.provider.send('eth_signTypedData_v4', [
      address.toLowerCase(),
      JSON.stringify(_TypedDataEncoder.getPayload(populated.domain, types, populated.value))
    ], maybeNetworkId(chainId))
  }

  sendTransaction(transaction: Deferrable<Transactionish>, chainId?: ChainId, allSigners?: boolean): Promise<TransactionResponse> {
    // TODO: use classic method..
    throw new Error('TODO')
  }

  signTransactions(txs: Deferrable<Transactionish>, chainId?: ChainId, allSigners?: boolean): Promise<SignedTransactions> {
    // TODO: use classic method.. or custom..?
    throw new Error('TODO')
  }

  sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainId): Promise<TransactionResponse> {
    // sequence_relay
    throw new Error('TODO')
  }

  updateConfig(newConfig?: WalletConfig): Promise<[WalletConfig, TransactionResponse | undefined]> {
    // sequence_updateConfig
    throw new Error('TODO')
  }

  publishConfig(): Promise<TransactionResponse> {
    // sequence_publishConfig
    throw new Error('TODO')
  }

  async isDeployed(chainId?: ChainId): Promise<boolean> {
    // use provider direct.. its read-only
    return false
  }

  //
  // ethers JsonRpcSigner methods
  //

  async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    return this.signTypedData(domain, types, value, chainId, allSigners)
  }

  connectUnchecked(): ethers.providers.JsonRpcSigner {
    throw new Error('connectUnchecked is unsupported')
  }

  sendUncheckedTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('sendUncheckedTransaction is unsupported')
  }

  async unlock(password: string): Promise<boolean> {
    const address = await this.getAddress()
    return this.provider.send("personal_unlockAccount", [ address.toLowerCase(), password, null ])
  }
}
