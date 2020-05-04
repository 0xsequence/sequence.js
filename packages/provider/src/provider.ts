import { Wallet } from "./wallet"
import { AsyncSendable } from "ethers/providers"
import { Web3Payload, Web3Response, ArcadeumTransaction } from "./types"
import { ethers } from "ethers"
import { toArcadeumTransaction } from "./utils"

export class Provider implements AsyncSendable {
  private readonly _wallet?: Wallet

  constructor(
    wallet: Wallet
  ) {
    this._wallet = wallet
  }

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

    if (transaction.delegateCall !== undefined) {
      const tx = this._wallet.relayer.relay(
        transaction.nonce,
        this._wallet.config,
        this._wallet.context,
        signature,
        transaction as ArcadeumTransaction
      )
      try {
        callback(undefined, {
          id: payload.id,
          jsonrpc: "2.0",
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
    try {
      callback(undefined, {
        id: payload.id,
        jsonrpc: "2.0",
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
      const nonce = transaction.nonce ? transaction.nonce : this._wallet.getNonce()
      const arctx = toArcadeumTransaction(this._wallet, transaction, false, transaction.gas)

      try {
        const signature = await this._wallet.signTransactions(await nonce, await arctx)
        callback(undefined, {
          id: payload.id,
          jsonrpc: "2.0",
          result: {
            raw: signature,
            tx: {
              nonce: ethers.utils.bigNumberify(await nonce).toHexString(),
              gas: ethers.utils.bigNumberify((await arctx).gasLimit).toHexString(),
              to: (await arctx).target,
              value: ethers.utils.bigNumberify((await arctx).value).toHexString(),
              input: (await arctx).data,
              ...(await arctx)
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
          jsonrpc: "2.0",
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
        jsonrpc: "2.0",
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
          jsonrpc: "2.0",
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
