import { ExternalProvider, TransactionResponse, JsonRpcProvider } from '@ethersproject/providers'
import { ethers, Signer as AbstractSigner } from 'ethers'
import { Wallet } from './wallet'

import { SequenceTransaction, isSequenceTransaction, toSequenceTransactions, readSequenceNonce, appendNonce, flattenAuxTransactions } from '@0xsequence/transactions'

import { JsonRpcRequest, JsonRpcResponse } from '@0xsequence/provider'

// TODO: what do we use this for?

// Provider is a low-level provider to a Sequence Wallet. 
export class Provider implements ExternalProvider {
  private readonly _wallet?: Wallet

  constructor(wallet: Wallet) {
    this._wallet = wallet
  }

  public readonly isMetaMask = false
  public readonly isExternalWallet = false

  get host(): string {
    return this.provider.host
  }

  get provider(): ExternalProvider {
    if (!this._wallet.connected) {
      throw Error('Wallet not connected')
    }
    return this._wallet.sender
  }

  sendAsync(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    if (!this.handle(request, callback)) {
      if (this.provider.sendAsync) {
        this.provider.sendAsync(request, callback)
      } else {
        this.provider.send(request, callback)
      }
    }
  }

  private handle(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    switch (request.method) {
      case 'eth_accounts':
        return this.accounts(request, callback)
      case 'eth_sendRawTransaction':
        return this.sendRawTransaction(request, callback)
      case 'eth_signTransaction':
        return this.signTransaction(request, callback)
      case 'eth_sign':
        return this.sign(request, callback)
      case 'eth_sendTransaction':
        return this.sendTransaction(request, callback)
      case 'eth_getTransactionCount':
        return this.getTransactionCount(request, callback)
    }
  }

  private async sendRawTransaction(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    const signature = request.params[0].raw
    const transaction = request.params[0].tx

    let tx: Promise<TransactionResponse>

    if (isSequenceTransaction(transaction)) {
      const arctx = flattenAuxTransactions([transaction])
      tx = this._wallet.relayer.relay(this._wallet.config, this._wallet.context, signature, ...(arctx as SequenceTransaction[]))
    }

    if (tx) {
      try {
        callback(undefined, {
          id: request.id,
          jsonrpc: '2.0',
          result: (await tx).hash
        })
      } catch (e) {
        callback(e)
      }
    } else {
      return false
    }
  }

  private async accounts(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    try {
      callback(undefined, {
        id: request.id,
        jsonrpc: '2.0',
        result: [this._wallet.address]
      })
    } catch (e) {
      callback(e)
    }

    return true
  }

  private async signTransaction(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    const transaction = request.params[0]
    const sender = transaction.from.toLowerCase()

    if (sender === this._wallet.address.toLowerCase()) {
      let arctxs = await toSequenceTransactions(this._wallet, [transaction])
      if (readSequenceNonce(...arctxs) === undefined) {
        arctxs = appendNonce(arctxs, await this._wallet.getNonce())
      }

      try {
        const signature = this._wallet.signTransactions(arctxs)
        callback(undefined, {
          id: request.id,
          jsonrpc: '2.0',
          result: {
            raw: await signature,
            tx:
              arctxs.length === 1
                ? arctxs[0]
                : {
                    ...arctxs[0],
                    auxiliary: arctxs.slice(1)
                  }
          }
        })
      } catch (e) {
        callback(e)
      }
    } else {
      return false
    }
  }

  private async sign(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    const signer = request.params[0]
    const message = request.params[1]

    if (signer === this._wallet.address.toLowerCase()) {
      const signature = this._wallet.signMessage(message)
      try {
        callback(undefined, {
          id: request.id,
          jsonrpc: '2.0',
          result: await signature
        })
      } catch (e) {
        callback(e)
      }
      return true
    } else {
      return false
    }
  }

  private async sendTransaction(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    const transaction = this._wallet.sendTransaction(request.params[0])
    try {
      callback(undefined, {
        id: request.id,
        jsonrpc: '2.0',
        result: (await transaction).hash
      })
    } catch (e) {
      callback(e)
    }
    return true
  }

  private async getTransactionCount(request: JsonRpcRequest, callback: (error: any, response?: JsonRpcResponse) => void) {
    const address = request.params[0].toLowerCase()

    if (address === this._wallet.address.toLowerCase()) {
      const count = this._wallet.getTransactionCount(request.params[1])
      try {
        callback(undefined, {
          id: request.id,
          jsonrpc: '2.0',
          result: ethers.BigNumber.from(await count).toHexString()
        })
      } catch (e) {
        callback(e)
      }
      return true
    } else {
      return false
    }
  }
}
