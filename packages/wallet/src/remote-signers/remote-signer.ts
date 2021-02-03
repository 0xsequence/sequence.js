import { BytesLike, Signer as AbstractSigner } from 'ethers'
import { TransactionRequest, TransactionResponse, Provider } from '@ethersproject/providers'
import { Deferrable } from '@ethersproject/properties'

export abstract class RemoteSigner extends AbstractSigner {

  abstract signMessageWithData(message: BytesLike, data?: BytesLike): Promise<string>

  signMessage(message: BytesLike): Promise<string> {
    return this.signMessageWithData(message)
  }

  sendTransaction(_: TransactionRequest): Promise<TransactionResponse> {
    throw new Error("sendTransaction method is not supported in RemoteSigner")
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error("signTransaction method is not supported in RemoteSigner")
  }

  connect(_: Provider): AbstractSigner {
    throw new Error("connect method is not supported in RemoteSigner")
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
