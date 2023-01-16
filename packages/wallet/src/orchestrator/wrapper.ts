
import { signers, Status } from "@0xsequence/signhub"
import { ethers } from "ethers"
import { Wallet } from "../wallet"

// Implements a wrapper for using Sequence wallets as nested signers
// in the signhub orchestrator. It only works for nested signatures.
export class SequenceOrchestratorWrapper implements signers.SapientSigner {
  constructor(public wallet: Wallet<any, any ,any>) {}

  async getAddress(): Promise<string> {
    return this.wallet.address
  }

  async requestSignature(message: ethers.utils.BytesLike, callbacks: {
    onSignature: (signature: ethers.utils.BytesLike) => void;
    onRejection: (error: string) => void;
    onStatus: (situation: string) => void
  }): Promise<boolean> {
    // For Sequence nested signatures we must use `signDigest` and not `signMessage`
    // otherwise the wallet will hash the digest and the signature will be invalid.
    callbacks.onSignature(await this.wallet.signDigest(message))
    return true
  }

  notifyStatusChange(_: Status): void {}

  isEOA(): boolean {
    return false
  }
}
