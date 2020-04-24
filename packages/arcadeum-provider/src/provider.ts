import { Wallet } from "./wallet";
import { AsyncSendable } from "ethers/providers";
import { Relayer } from "./relayer/relayer";
import { Web3Payload, Web3Response } from "./types";

export class ArcadeumProvider implements AsyncSendable {
  private readonly _wallet?: Wallet
  private readonly _relayer: Relayer
  private readonly _provider: AsyncSendable

  constructor(
    relayer: Relayer,
    provider: AsyncSendable,
    wallet: Wallet
  ) {
    this._wallet = wallet
    this._relayer = relayer
    this._provider = provider
  }

  public readonly isMetaMask = false

  get host(): string {
    return this._provider.host
  }

  sendAsync(payload: Web3Payload, callback: (error: any, response: Web3Response) => void) {
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
        })

        return

      case 'eth_sendTransaction':
        this._wallet.sendTransaction(payload.params[0]).then((tr) => {
          callback(undefined, {
            id: payload.id,
            jsonrpc: "2.0",
            result: tr.hash
          })
        })

        return
    }

    return this._provider.sendAsync(payload, callback)
  }
}
