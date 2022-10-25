import { BytesLike, Signer as AbstractSigner, providers, utils } from 'ethers'
import { ChainIdLike } from '@0xsequence/network'

type Provider = providers.Provider
type TransactionRequest = providers.TransactionRequest
type TransactionResponse = providers.TransactionResponse
type Deferrable<T> = utils.Deferrable<T>

export abstract class RemoteSigner extends AbstractSigner {
  abstract signMessageWithData(message: BytesLike, data?: BytesLike, chainId?: ChainIdLike): Promise<string>

  signMessage(message: BytesLike, chainId?: number): Promise<string> {
    return this.signMessageWithData(message)
  }

  sendTransaction(_: TransactionRequest): Promise<TransactionResponse> {
    throw new Error('sendTransaction method is not supported in RemoteSigner')
  }

  signTransaction(_: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('signTransaction method is not supported in RemoteSigner')
  }

  connect(_: Provider): AbstractSigner {
    throw new Error('connect method is not supported in RemoteSigner')
  }

  static signMessageWithData(signer: AbstractSigner, message: BytesLike, data?: BytesLike, chainId?: number): Promise<string> {
    if (this.isRemoteSigner(signer)) {
      return (signer as RemoteSigner).signMessageWithData(message, data, chainId)
    }
    return signer.signMessage(message)
  }

  static isRemoteSigner(signer: AbstractSigner): signer is RemoteSigner {
    return (<RemoteSigner>signer).signMessageWithData !== undefined
  }
}
