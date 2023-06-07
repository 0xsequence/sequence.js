import { ethers, BytesLike, Bytes, providers, TypedDataDomain, TypedDataField, BigNumber } from 'ethers'
import {
  NetworkConfig,
  WalletContext,
  ChainIdLike,
  JsonRpcHandler,
  JsonRpcFetchFunc,
  JsonRpcRequest,
  JsonRpcResponseCallback,
  maybeChainId,
  JsonRpcSender
} from '@0xsequence/network'
import { resolveArrayProperties, Signer } from '@0xsequence/wallet'
import { WalletConfig, WalletState } from '@0xsequence/config'
import { Relayer } from '@0xsequence/relayer'
import { Deferrable, shallowCopy, resolveProperties, Forbid } from '@0xsequence/utils'
import { TransactionRequest, TransactionResponse, SignedTransactions } from '@0xsequence/transactions'
import { WalletRequestHandler } from './transports/wallet-request-handler'

export class Web3Provider extends providers.Web3Provider implements JsonRpcHandler {
  static isSequenceProvider(cand: any): cand is Web3Provider {
    return isSequenceProvider(cand)
  }

  readonly _sender: JsonRpcSender

  readonly _isSequenceProvider: boolean

  // defaultChainId is the default chainId to use with requests, but may be
  // overridden by passing chainId argument to a specific request
  readonly _defaultChainId?: number

  constructor(provider: providers.JsonRpcProvider | JsonRpcHandler | JsonRpcFetchFunc, defaultChainId?: ChainIdLike) {
    const sender = new JsonRpcSender(provider, maybeChainId(defaultChainId))
    provider = sender

    super(provider, 'any')

    this._sender = sender
    this._isSequenceProvider = true
    this._defaultChainId = maybeChainId(defaultChainId)
  }

  sendAsync(
    request: JsonRpcRequest,
    callback: JsonRpcResponseCallback | ((error: any, response: any) => void),
    chainId?: number
  ) {
    this._sender.sendAsync(request, callback, chainId)
  }

  send(method: string, params: Array<any>, chainId?: number): Promise<any> {
    return this._sender.send(method, params, chainId)
  }

  request(request: { method: string; params?: Array<any>; chainId?: number }): Promise<any> {
    return this.send(request.method, request.params || [], request.chainId)
  }

  getSigner(): Web3Signer {
    return new Web3Signer(this, this._defaultChainId)
  }

  async getChainId(): Promise<number> {
    // TODO: is it safe to memoize this?
    const result = await this.send('eth_chainId', [])
    const chainId = ethers.BigNumber.from(result).toNumber()

    if (this._defaultChainId && this._defaultChainId !== chainId) {
      throw new Error(`provider chainId (${chainId}) does not match provider-bound chainId ${this._defaultChainId}`)
    }

    return chainId
  }
}

export function isSequenceProvider(provider: any): provider is Web3Provider {
  const cand = provider as Web3Provider
  return cand && cand.send !== undefined && cand._isSequenceProvider === true
}

export class LocalWeb3Provider extends Web3Provider {
  constructor(signer: Signer, networks?: NetworkConfig[]) {
    const walletRequestHandler = new WalletRequestHandler(signer, null, networks || [])
    super(walletRequestHandler)
  }
}

// TODO: in the future with ethers v6 we can remove/change this type name
interface TypedDataSigner {
  _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>
  ): Promise<string>
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
  private _providers: { [key: number]: Web3Provider } = {}

  //
  // ethers AbstractSigner methods
  //

  async getAddress(): Promise<string> {
    if (this._address) return this._address
    const accounts = await this.provider.send('eth_accounts', [])
    this._address = accounts[0]
    this._index = 0
    return ethers.utils.getAddress(this._address)
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

  // getProvider returns a Web3Provider instance for the current chain. Note that this method
  // and signer is bound to a particular chain to prevent misuse. If you'd like a provider
  // for a specific chain, try getSender(chainId), or wallet.getProvider(chainId).
  async getProvider(chainId?: number): Promise<Web3Provider | undefined> {
    if (chainId) {
      const currentChainId = await this.getChainId()
      if (currentChainId !== chainId) {
        throw new Error(`signer is attempting to access chain ${chainId}, but is already bound to chain ${currentChainId}`)
      }
    }
    return this.provider
  }

  // getSender returns a Web3Provider instance via the signer transport. Note: for our case
  // the of sequence wallet, this will bring up the wallet window whenever using it, as the json-rpc
  // requests are sent to the window transport. Therefore, for anything non-signing related
  // you can write a higher-order JsonRpcRouter sender to route to the public provider endpoints
  // as we do in the WalletProvider.
  //
  // This method is primarily utilized internally when routing requests to a particular chainId.
  async getSender(chainId?: number): Promise<Web3Provider | undefined> {
    if (!chainId || (chainId && chainId === this.defaultChainId)) {
      return this.provider
    }
    if (!this._providers[chainId]) {
      this._providers[chainId] = new Web3Provider(new JsonRpcSender(this.provider, chainId), chainId)
    }
    return this._providers[chainId]
  }

  getRelayer(chainId?: number): Promise<Relayer | undefined> {
    // TODO: JsonRpcRelayer ......? or, Web3Relayer.. or SequenceRelayer?
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

  async getWalletConfig(chainId?: ChainIdLike): Promise<WalletConfig[]> {
    return await this.provider.send(
      'sequence_getWalletConfig',
      [maybeChainId(chainId)],
      maybeChainId(chainId) || this.defaultChainId
    )
  }

  async getWalletState(chainId?: ChainIdLike): Promise<WalletState[]> {
    return await this.provider.send(
      'sequence_getWalletState',
      [maybeChainId(chainId)],
      maybeChainId(chainId) || this.defaultChainId
    )
  }

  async getNetworks(): Promise<NetworkConfig[]> {
    if (!this._networks) {
      this._networks = await this.provider.send('sequence_getNetworks', [])
    }
    return this._networks
  }

  async getSigners(): Promise<string[]> {
    const networks = await this.getNetworks()

    const authChainId = networks.find(n => n.isAuthChain)
    if (!authChainId) {
      throw new Error('authChainId could not be determined from network list')
    }

    const walletConfig = await this.getWalletConfig(authChainId)
    if (!walletConfig || walletConfig.length === 0) {
      throw new Error(`walletConfig returned zero results for authChainId {authChainId}`)
    }

    return walletConfig[0].signers.map(s => s.address)
  }

  // signMessage matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async signMessage(message: BytesLike, chainId?: ChainIdLike, allSigners?: boolean): Promise<string> {
    const provider = await this.getSender(maybeChainId(chainId) || this.defaultChainId)

    const data = typeof message === 'string' ? ethers.utils.toUtf8Bytes(message) : message
    const address = await this.getAddress()

    // NOTE: as of ethers v5.5, it switched to using personal_sign, see
    // https://github.com/ethers-io/ethers.js/pull/1542 and see
    // https://github.com/WalletConnect/walletconnect-docs/issues/32 for additional info.
    return await provider!.send('personal_sign', [ethers.utils.hexlify(data), address])
  }

  // signTypedData matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<string> {
    // Populate any ENS names (in-place)
    // const populated = await ethers.utils._TypedDataEncoder.resolveNames(domain, types, message, (name: string) => {
    //   return this.provider.resolveName(name)
    // })

    return await this.provider.send(
      'eth_signTypedData_v4',
      [await this.getAddress(), ethers.utils._TypedDataEncoder.getPayload(domain, types, message)],
      maybeChainId(chainId) || this.defaultChainId
    )
  }

  // sendTransaction matches implementation from ethers JsonRpcSigner for compatibility, but with
  // multi-chain support.
  async sendTransaction(
    transaction: Deferrable<TransactionRequest>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<TransactionResponse> {
    const provider = await this.getSender(maybeChainId(chainId) || this.defaultChainId)

    const tx = this.sendUncheckedTransaction(transaction, chainId).then(hash => {
      return ethers.utils
        .poll(
          () => {
            return provider!.getTransaction(hash).then((tx: TransactionResponse) => {
              if (tx === null) {
                return undefined
              }
              return provider!._wrapTransaction(tx, hash)
            })
          },
          { onceBlock: this.provider! }
        )
        .catch((error: Error) => {
          ;(<any>error).transactionHash = hash
          throw error
        })
    })

    // @ts-ignore
    return tx
  }

  // sendTransactionBatch is a convenience method to call sendTransaction in a batch format, allowing you to
  // send multiple transaction as a single payload and just one on-chain transaction.
  async sendTransactionBatch(
    transactions: Deferrable<Forbid<TransactionRequest, 'wait'>[]>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<TransactionResponse> {
    const batch = await resolveArrayProperties<Forbid<TransactionRequest, 'wait'>[]>(transactions)
    if (!batch || batch.length === 0) {
      throw new Error('cannot send empty batch')
    }

    // sendTransactionBatch only accepts TransactionRequest, not TransactionResponses
    if (batch.find(v => v.wait !== undefined && v.wait !== null)) {
      throw new Error('transaction request expected for sendTransactionBatch, transaction response found')
    }

    const tx: TransactionRequest = { ...batch[0] }
    if (batch.length > 1) {
      tx.auxiliary = batch.splice(1)
    }

    return this.sendTransaction(tx, chainId, allSigners)
  }

  signTransactions(
    transaction: Deferrable<TransactionRequest>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<SignedTransactions> {
    transaction = shallowCopy(transaction)
    // TODO: transaction argument..? make sure to resolve any properties and serialize property before sending over
    // the wire.. see sendUncheckedTransaction and resolveProperties
    return this.provider.send('eth_signTransaction', [transaction], maybeChainId(chainId) || this.defaultChainId)
  }

  sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainIdLike): Promise<TransactionResponse> {
    // sequence_relay
    throw new Error('TODO')
  }

  // updateConfig..
  // NOTE: this is not supported by the remote wallet by default.
  async updateConfig(newConfig?: WalletConfig): Promise<[WalletConfig, TransactionResponse | undefined]> {
    // sequence_updateConfig
    const [config, tx] = await this.provider.send('sequence_updateConfig', [newConfig], this.defaultChainId)
    if (tx === null) {
      return [config, undefined]
    }

    const provider = await this.getSender(this.defaultChainId)
    return [config, provider!._wrapTransaction(tx, tx.hash)]
  }

  // publishConfig..
  // NOTE: this is not supported by the remote wallet by default.
  async publishConfig(): Promise<TransactionResponse | undefined> {
    const provider = await this.getSender(this.defaultChainId)

    const tx = await provider!.send('sequence_publishConfig', [])
    if (tx === null) {
      return undefined
    }
    return provider!._wrapTransaction(tx, tx.hash)
  }

  async isDeployed(chainId?: ChainIdLike): Promise<boolean> {
    const provider = await this.getSender(maybeChainId(chainId))
    const walletCode = await provider!.getCode(await this.getAddress())
    return !!walletCode && walletCode !== '0x'
  }

  //
  // ethers JsonRpcSigner methods
  //

  async _legacySignMessage(message: Bytes | string, chainId?: ChainIdLike, allSigners?: boolean): Promise<string> {
    const provider = await this.getSender(maybeChainId(chainId) || this.defaultChainId)

    const data = typeof message === 'string' ? ethers.utils.toUtf8Bytes(message) : message
    const address = await this.getAddress()

    // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
    // NOTE: ethers since 5.5 has switched to using personal_sign, we should review, etc.
    return await provider!.send('eth_sign', [address, ethers.utils.hexlify(data)])
  }

  async _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<string> {
    return this.signTypedData(domain, types, message, chainId, allSigners)
  }

  async sendUncheckedTransaction(transaction: Deferrable<TransactionRequest>, chainId?: ChainIdLike): Promise<string> {
    transaction = shallowCopy(transaction)

    const fromAddress = this.getAddress()

    // NOTE: we do not use provider estimation, and instead rely on our relayer to determine the gasLimit and gasPrice
    //
    // TODO: alternatively/one day, we could write a provider middleware to eth_estimateGas
    // and send it to our relayer url instead for estimation..
    //
    // if (!transaction.gasLimit) {
    //   const estimate = shallowCopy(transaction)
    //   estimate.from = fromAddress
    //   transaction.gasLimit = this.provider.estimateGas(estimate)
    // }

    const provider = await this.getSender(maybeChainId(chainId) || this.defaultChainId)

    return resolveProperties({
      tx: resolveProperties(transaction),
      sender: await fromAddress
    }).then(({ tx, sender }) => {
      if (tx.from != null) {
        if (ethers.utils.getAddress(tx.from) !== sender) {
          // logger.throwArgumentError("from address mismatch", "transaction", transaction)
          throw new Error(`from address mismatch for transaction ${transaction}`)
        }
      } else {
        tx.from = sender
      }

      const hexTx = hexlifyTransaction(tx)

      return provider!.send('eth_sendTransaction', [hexTx]).then(
        hash => {
          return hash
        },
        error => {
          // return checkError("sendTransaction", error, hexTx)
          throw error
        }
      )
    })
  }

  connectUnchecked(): ethers.providers.JsonRpcSigner {
    return new UncheckedJsonRpcSigner(this.provider, this.defaultChainId)
  }

  async unlock(password: string): Promise<boolean> {
    const address = await this.getAddress()
    return this.provider.send('personal_unlockAccount', [address, password, null])
  }
}

// NOTE: method has been copied + modified from ethers.js JsonRpcProvider
// Convert an ethers.js transaction into a JSON-RPC transaction

const allowedTransactionKeys: { [key: string]: boolean } = {
  chainId: true,
  data: true,
  gasLimit: true,
  gasPrice: true,
  nonce: true,
  to: true,
  value: true,
  from: true,
  auxiliary: true,
  expiration: true,
  afterNonce: true,
  delegateCall: true,
  revertOnError: true
}

const hexlifyTransaction = (
  transaction: TransactionRequest,
  allowExtra?: { [key: string]: boolean }
): { [key: string]: string } => {
  // Check only allowed properties are given
  const allowed = shallowCopy(allowedTransactionKeys)
  if (allowExtra) {
    for (const key in allowExtra) {
      if (allowExtra[key]) {
        allowed[key] = true
      }
    }
  }
  ethers.utils.checkProperties(transaction, allowed)

  const result: { [key: string]: any } = {}

  // Some nodes (INFURA ropsten; INFURA mainnet is fine) do not like leading zeros.
  ;['gasLimit', 'gasPrice', 'nonce', 'value'].forEach(key => {
    const value = (transaction as any)[key]
    if (value === null || value === undefined) {
      return
    }
    const hexValue = ethers.utils.hexValue(value)
    if (key === 'gasLimit') {
      key = 'gas'
    }
    result[key] = hexValue
  })
  ;['from', 'to', 'data'].forEach(key => {
    if (!(<any>transaction)[key]) {
      return
    }
    result[key] = ethers.utils.hexlify((<any>transaction)[key])
  })
  ;['delegateCall', 'revertOnError'].forEach(key => {
    const value = (transaction as any)[key]
    if (value !== undefined && value !== null) {
      result[key] = value
    }
  })

  const auxiliary = <any>transaction['auxiliary']
  if (auxiliary && auxiliary.length > 0) {
    result['auxiliary'] = []
    auxiliary.forEach((a: any) => {
      result['auxiliary'].push(hexlifyTransaction(a))
    })
  }

  return result
}

class UncheckedJsonRpcSigner extends Web3Signer {
  sendTransaction(transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
    return this.sendUncheckedTransaction(transaction).then(hash => {
      return <TransactionResponse>{
        chainId: 0,
        confirmations: 0,
        data: '',
        from: '',
        gasLimit: ethers.constants.Zero,
        gasPrice: ethers.constants.Zero,
        hash,
        nonce: 0,
        value: ethers.constants.Zero,
        wait: (confirmations?: number) => this.provider.waitForTransaction(hash, confirmations)
      }
    })
  }
}
