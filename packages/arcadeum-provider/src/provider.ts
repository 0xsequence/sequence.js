import { Subprovider } from "./commons/subprovider";
import { JSONRPCRequestPayload } from "ethereum-types";
import { Callback, ErrorCallback } from "./types";
import { Wallet } from "./wallet";

class Provider extends Subprovider {
  private readonly _wallet: Wallet

  constructor(wallet: Wallet) {
    super()
    this._wallet = wallet
  }

  public async handleRequest(
    payload: JSONRPCRequestPayload,
    next: Callback,
    end: ErrorCallback
  ): Promise<void> {
    let address: string

    switch(payload.method) {
      case 'eth_coinbase':
        end(null, this._wallet.address)
        return

      case 'eth_accounts':
        end(null, [this._wallet.address])
        return

      case 'eth_sendTransaction':
        // TODO Implement
        end(Error('Not implemented'))
        return

      case 'eth_signTransaction':
        // TODO Implement
        // Return tx signed by relayer?
        end(Error('Not implemented'))
        return

      case 'eth_sign':
      case 'personal_sign':
        const data = payload.method === 'eth_sign' ? payload.params[1] : payload.params[0];
        address = payload.method === 'eth_sign' ? payload.params[0] : payload.params[1];

        if (address === this._wallet.address) {
          end(null, this._wallet.signMessage(data))
        } else {
          end(Error('Invalid signer'))
        }

      case 'eth_signTypedData':
        // TODO Implement
        end(Error('Not implemented'))
        return
    }
  }
}
