
import { TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { BytesLike, Signer as AbstractSigner } from 'ethers'

export abstract class RemoteSigner extends AbstractSigner {
  signMessage(message: BytesLike): Promise<string> {
    return this.signMessageWithData(message)
  }

  abstract signMessageWithData(message: BytesLike, data?: BytesLike): Promise<string>

  sendTransaction(_: TransactionRequest): Promise<TransactionResponse> {
    throw new Error("sendTransaction not implemented.")
  }

  static signMessageWithData(signer: AbstractSigner, message: BytesLike, data?: BytesLike): Promise<string> {
    if (this.isRemoteSigner(signer)) {
      return (signer as RemoteSigner).signMessageWithData(message, data)
    }

    return signer.signMessage(message)
  }

  static isRemoteSigner(signer: AbstractSigner): boolean {
    return (<RemoteSigner>signer).signMessageWithData !== undefined
  }
}
