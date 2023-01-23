import { ethers } from "ethers"
import { Status } from "../orchestrator"

export interface SapientSigner {
  getAddress(): Promise<string>

  requestSignature(message: ethers.BytesLike, metadata: Object, callbacks: {
    onSignature: (signature: ethers.BytesLike) => void,
    onRejection: (error: string) => void,
    onStatus: (situation: string) => void
  }): Promise<boolean>

  notifyStatusChange(
    status: Status,
    metadata: Object
  ): void

  isEOA(): boolean
}

export function isSapientSigner(signer: ethers.Signer | SapientSigner): signer is SapientSigner {
  return (signer as SapientSigner).requestSignature !== undefined && (signer as SapientSigner).notifyStatusChange !== undefined
}
