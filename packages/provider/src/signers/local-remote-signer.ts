import { RemoteSigner } from "./remote-signer"
import { Signer as AbstractSigner } from 'ethers'
import { Arrayish } from "ethers/utils"


export class LocalRemoteSigner extends RemoteSigner {
  private readonly _signer: AbstractSigner

  constructor(signer: AbstractSigner) {
    super()
    this._signer = signer
  }

  signMessageWithData(message: Arrayish, _?: Arrayish): Promise<string> {
    return this._signer.signMessage(message)
  }

  getAddress(): Promise<string> {
    return this._signer.getAddress()
  }
}
