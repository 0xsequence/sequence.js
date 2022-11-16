import { BytesLike, Signer as AbstractSigner, providers, utils } from 'ethers'
import { RemoteSigner } from './remote-signer'

export class LocalRemoteSigner extends RemoteSigner {
  private readonly _signer: AbstractSigner

  constructor(signer: AbstractSigner) {
    super()
    this._signer = signer
  }

  signMessageWithData(message: BytesLike, _?: BytesLike): Promise<string> {
    return this._signer.signMessage(message)
  }

  getAddress(): Promise<string> {
    return this._signer.getAddress()
  }
}
