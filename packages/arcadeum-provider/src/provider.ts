import { Wallet } from "./wallet"
import { AsyncSendable } from "ethers/providers"
import { Web3Payload, Web3Response } from "./types"
import { ethers } from "ethers"

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
    switch (payload.method) {
      case 'eth_sign':
        const signer = payload.params[0]
        const message = payload.params[1]

        if (signer && signer !== this._wallet.address) throw Error('Wrong signed')

        this._wallet.signMessage(message).then((signature) => {
          callback(undefined, {
            id: payload.id,
            jsonrpc: "2.0",
            result: signature
          })
        }).catch((e) => callback(e))

        return

      case 'eth_sendTransaction':
        this._wallet.sendTransaction(payload.params[0]).then((tr) => {
          callback(undefined, {
            id: payload.id,
            jsonrpc: "2.0",
            result: tr.hash
          })
        }).catch((e) => callback(e))

        return

      case 'eth_getTransactionCount':
        const address = payload.params[0].toLowerCase()
        if (address === this._wallet.address.toLowerCase()) {
          this._wallet.getTransactionCount(payload.params[1]).then((count) => {
            callback(undefined, {
              id: payload.id,
              jsonrpc: "2.0",
              result: ethers.utils.bigNumberify(count).toHexString()
            })
          }).catch((e) => callback(e))

          return
        }

        break
    }

    return this.provider.sendAsync(payload, callback)
  }
}
