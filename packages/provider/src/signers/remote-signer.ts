
import { Signer as AbstractSigner } from 'ethers'
import { Arrayish } from 'ethers/utils'
import { TransactionRequest, TransactionResponse } from 'ethers/providers'

export abstract class RemoteSigner extends AbstractSigner {
  signMessage(message: Arrayish): Promise<string> {
    return this.signMessageWithData(message)
  }

  abstract signMessageWithData(message: Arrayish, data?: Arrayish): Promise<string>

  sendTransaction(_: TransactionRequest): Promise<TransactionResponse> {
    throw new Error("sendTransaction not implemented.")
  }

  static isRemoteSigner(signer: AbstractSigner): boolean {
    return (<RemoteSigner>signer).signMessageWithData !== undefined
  }

  static signMessageWithData(signer: AbstractSigner, message: Arrayish, data?: Arrayish): Promise<string> {
    if (this.isRemoteSigner(signer)) {
      return (signer as RemoteSigner).signMessageWithData(message, data)
    }

    return signer.signMessage(message)
  }
}
