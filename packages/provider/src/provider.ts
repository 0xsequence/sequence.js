import { Wallet } from './wallet'
import { AsyncSendable, TransactionResponse } from 'ethers/providers'
import { Web3Payload, Web3Response, ArcadeumTransaction } from './types'
import { ethers } from 'ethers'
import { isArcadeumTransaction, toArcadeumTransactions, readArcadeumNonce, appendNonce, flattenAuxTransactions } from './utils'

export class Provider implements AsyncSendable {
  private readonly _wallet?: Wallet

  constructor(wallet: Wallet) {
    this._wallet = wallet
  }

  // TODO: rename to isExternalWallet ?
  public readonly isMetaMask = false

  get host(): string {
    return this.provider.host
  }

  get provider(): AsyncSendable {
    if (!this._wallet.connected) {
      throw Error('Wallet not connected')
    }

    return this._wallet.w3provider
  }

  sendAsync(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    if (!this.handle(payload, callback)) {
      if (this.provider.sendAsync) {
        this.provider.sendAsync(payload, callback)
      } else {
        this.provider.send(payload, callback)
      }
    }
  }

  private handle(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    switch (payload.method) {
      case 'eth_accounts':
        return this.accounts(payload, callback)
      case 'eth_sendRawTransaction':
        return this.sendRawTransaction(payload, callback)
      case 'eth_signTransaction':
        return this.signTransaction(payload, callback)
      case 'eth_sign':
        return this.sign(payload, callback)
      case 'eth_sendTransaction':
        return this.sendTransaction(payload, callback)
      case 'eth_getTransactionCount':
        return this.getTransactionCount(payload, callback)
    }
  }

  private async sendRawTransaction(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    const signature = payload.params[0].raw
    const transaction = payload.params[0].tx

    let tx: Promise<TransactionResponse>

    if (isArcadeumTransaction(transaction)) {
      const arctx = flattenAuxTransactions(transaction)
      tx = this._wallet.relayer.relay(this._wallet.config, this._wallet.context, signature, ...(arctx as ArcadeumTransaction[]))
    }

    if (tx) {
      try {
        callback(undefined, {
          id: payload.id,
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

  private async accounts(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    try {
      callback(undefined, {
        id: payload.id,
        jsonrpc: '2.0',
        result: [this._wallet.address]
      })
    } catch (e) {
      callback(e)
    }

    return true
  }

  private async signTransaction(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    const transaction = payload.params[0]
    const sender = transaction.from.toLowerCase()

    if (sender === this._wallet.address.toLowerCase()) {
      let arctxs = await toArcadeumTransactions(this._wallet, [transaction])
      if (readArcadeumNonce(...arctxs) === undefined) {
        arctxs = appendNonce(arctxs, await this._wallet.getNonce())
      }

      try {
        const signature = this._wallet.signTransactions(...arctxs)
        callback(undefined, {
          id: payload.id,
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

  private async sign(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    const signer = payload.params[0]
    const message = payload.params[1]

    if (signer === this._wallet.address.toLowerCase()) {
      const signature = this._wallet.signMessage(message)
      try {
        callback(undefined, {
          id: payload.id,
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

  private async sendTransaction(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    const transaction = this._wallet.sendTransaction(payload.params[0])
    try {
      callback(undefined, {
        id: payload.id,
        jsonrpc: '2.0',
        result: (await transaction).hash
      })
    } catch (e) {
      callback(e)
    }
    return true
  }

  private async getTransactionCount(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    const address = payload.params[0].toLowerCase()

    if (address === this._wallet.address.toLowerCase()) {
      const count = this._wallet.getTransactionCount(payload.params[1])
      try {
        callback(undefined, {
          id: payload.id,
          jsonrpc: '2.0',
          result: ethers.utils.bigNumberify(await count).toHexString()
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
