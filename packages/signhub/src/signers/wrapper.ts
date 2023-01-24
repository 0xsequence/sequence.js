
import { ethers } from 'ethers'
import { Status } from '../orchestrator'
import { SapientSigner } from './signer'

export class SignerWrapper implements SapientSigner {
  constructor(public signer: ethers.Signer, public eoa: boolean = true) {}

  getAddress(): Promise<string> {
    return this.signer.getAddress()
  }

  async requestSignature(
    _id: string,
    message: ethers.utils.BytesLike,
    _metadata: Object,
    callbacks: {
      onSignature: (signature: ethers.utils.BytesLike) => void;
      onRejection: (error: string) => void;
      onStatus: (situation: string) => void
    }
  ): Promise<boolean> {
    callbacks.onSignature(await this.signer.signMessage(message))
    return true
  }

  notifyStatusChange(_i: string, _s: Status, _m: Object): void {}

  isEOA(): boolean {
    return this.eoa
  }
}
