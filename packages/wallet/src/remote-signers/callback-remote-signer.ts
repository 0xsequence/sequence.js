import { BytesLike } from 'ethers'
import { ChainIdLike } from '@0xsequence/network'
import { RemoteSigner } from './remote-signer'

export type SignCallback = (message: BytesLike, data?: BytesLike, chainId?: ChainIdLike) => Promise<string>

export class CallbackRemoteSigner extends RemoteSigner {
  constructor(public readonly address: string, public readonly callback: SignCallback) {
    super()
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.address)
  }

  signMessageWithData(message: BytesLike, data?: BytesLike, chainId?: ChainIdLike): Promise<string> {
    return this.callback(message, data, chainId)
  }
}
