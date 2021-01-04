import { TransactionRequest, Provider } from "@ethersproject/providers"
import { BytesLike, Signer as AbstractSigner } from 'ethers'
import { Deferrable } from "ethers/lib/utils"
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

  signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error("signTransaction method is not supported in LocalRemoteSigner")
  }
  
  connect(provider: Provider): AbstractSigner {
    throw new Error("connect method is not supported in LocalRemoteSigner")
  }
}
