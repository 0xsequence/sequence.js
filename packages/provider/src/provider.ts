import { ethers } from 'ethers'
import { BytesLike } from '@ethersproject/bytes'
import { Web3Provider as EthersWeb3Provider, ExternalProvider, JsonRpcProvider, Networkish } from "@ethersproject/providers"
import { TypedDataDomain, TypedDataField, TypedDataSigner } from '@ethersproject/abstract-signer'
import { _TypedDataEncoder } from '@ethersproject/hash'
import { poll } from '@ethersproject/web'
import { NetworkConfig, Networks, WalletContext, ChainId, JsonRpcHandler, JsonRpcHandlerFunc, JsonRpcFetchFunc, JsonRpcRequest, JsonRpcResponseCallback, JsonRpcResponse, maybeNetworkId } from '@0xsequence/network'
import { Signer, WalletConfig, WalletState } from '@0xsequence/wallet'
import { Relayer } from '@0xsequence/relayer'
import { Deferrable, shallowCopy, resolveProperties } from '@0xsequence/utils'
import { TransactionRequest, TransactionResponse, Transactionish, SignedTransactions } from '@0xsequence/transactions'
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
// SequenceRelayer
// SequenceChaind -- ..? Collector ..? Data..? .. for events, balances, metadata, Node.. Sidekick ..?
// SequenceAPI -- various things..

// ..? or just Provider and Signer ..? or.. Web3Provider, etc..?

// TODO: add SequenceProvider
// which will take networks (or none and fetch initially on connect..?), or, from fetch(https://sequence.app/networks.json) ?

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
    if (typeof (provider) === 'function') {
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

  // memoized
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
    // TODO .. since ethers isn't using this method, perhaps we will?
    throw new Error('signTransaction is unsupported, use signTransactions instead')
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

  async getSigners(): Promise<string[]> {
    // first sequence_getNetworks
    // find the auth chain, etc........?

    // call, sequence_getWalletConfig
    // .. passing the authChain ..?

    // and then get list of signers
    throw new Error('TODO')
  }

  // signMessage matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async signMessage(message: BytesLike, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    const data = ((typeof(message) === 'string') ? ethers.utils.toUtf8Bytes(message): message)
    const address = await this.getAddress()

    // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
    return await this.provider.send('eth_sign', [
      address.toLowerCase(), ethers.utils.hexlify(data)
    ], maybeNetworkId(chainId) || this.defaultChainId)
  }

  // signTypedData matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    // Populate any ENS names (in-place)
    const populated = await _TypedDataEncoder.resolveNames(domain, types, value, (name: string) => {
      return this.provider.resolveName(name)
    })

    const address = await this.getAddress()

    return await this.provider.send('eth_signTypedData_v4', [
      address.toLowerCase(),
      JSON.stringify(_TypedDataEncoder.getPayload(populated.domain, types, populated.value))
    ], maybeNetworkId(chainId) || this.defaultChainId)
  }

  // sendTransaction matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  sendTransaction(transaction: Deferrable<TransactionRequest>, chainId?: ChainId, allSigners?: boolean): Promise<TransactionResponse> {
    return this.sendUncheckedTransaction(transaction, chainId).then((hash) => {
      return poll(() => {
        // TODO: we need to getTransaction from the right chain .....
        return this.provider.getTransaction(hash).then((tx: TransactionResponse) => {
          if (tx === null) { return undefined }
          return this.provider._wrapTransaction(tx, hash)
        })
      }, { onceBlock: this.provider }).catch((error: Error) => {
        (<any>error).transactionHash = hash
        throw error
      })
    })
  }

  signTransactions(transaction: Deferrable<TransactionRequest>, chainId?: ChainId, allSigners?: boolean): Promise<SignedTransactions> {
    transaction = shallowCopy(transaction)
    // TODO: transaction argument..? stringify..?
    return this.provider.send('eth_signTransaction', [transaction], maybeNetworkId(chainId) || this.defaultChainId)
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
    // but, we need access to the chain, so, this.provider()
    // needs a method like .getChainProvider() or something..?
    // 
    return false
  }

  //
  // ethers JsonRpcSigner methods
  //

  async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    return this.signTypedData(domain, types, value, chainId, allSigners)
  }

  // sendUncheckedTransaction matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  sendUncheckedTransaction(transaction: Deferrable<TransactionRequest>, chainId?: ChainId): Promise<string> {
    transaction = shallowCopy(transaction)

    const fromAddress = this.getAddress().then((address) => {
      if (address) { address = address.toLowerCase() }
      return address
    })

    // The JSON-RPC for eth_sendTransaction uses 90000 gas; if the user
    // wishes to use this, it is easy to specify explicitly, otherwise
    // we look it up for them.
    if (transaction.gasLimit == null) {
      const estimate = shallowCopy(transaction)
      estimate.from = fromAddress
      transaction.gasLimit = this.provider.estimateGas(estimate)
    }

    return resolveProperties({
      tx: resolveProperties(transaction),
      sender: fromAddress
    }).then(({ tx, sender }) => {
      if (tx.from != null) {
        if (tx.from.toLowerCase() !== sender) {
          // logger.throwArgumentError("from address mismatch", "transaction", transaction)
          throw new Error(`from address mismatch for transaction ${transaction}`)
        }
      } else {
        tx.from = sender;
      }

      const hexTx = (<any>this.provider.constructor).hexlifyTransaction(tx, { from: true })

      return this.provider.send('eth_sendTransaction', [hexTx], maybeNetworkId(chainId) || this.defaultChainId).then((hash) => {
        return hash
      }, (error) => {
        // return checkError("sendTransaction", error, hexTx)
        throw new Error(`sendTransaction ${error}`)
      })
    })
  }

  connectUnchecked(): ethers.providers.JsonRpcSigner {
    throw new Error('connectUnchecked is unsupported')
  }

  async unlock(password: string): Promise<boolean> {
    const address = await this.getAddress()
    return this.provider.send("personal_unlockAccount", [address.toLowerCase(), password, null])
  }
}
