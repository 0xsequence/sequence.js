import { ethers } from "ethers"
import { isSapientSigner, SapientSigner } from "./signers/signer"
import { SignerWrapper } from "./signers/wrapper"

export type Status = {
  ended: boolean,
  message: ethers.BytesLike,
  signers: { [signer: string]: SignerStatus },
}

export type SignerStatusPending = {
  situation?: string
}

export type SignerStatusRejected = {
  rejected: true,
  error?: string
}

export type SignerStatusSigned = {
  signature: ethers.BytesLike,
  isEOA: boolean
}

export type SignerStatus = SignerStatusPending | SignerStatusRejected | SignerStatusSigned

export function isSignerStatusRejected(status: SignerStatus): status is SignerStatusRejected {
  return (status as SignerStatusRejected).rejected
}

export function isSignerStatusSigned(status: SignerStatus): status is SignerStatusSigned {
  return (status as SignerStatusSigned).signature !== undefined
}

export function isSignerStatusPending(status: SignerStatus): status is SignerStatusPending {
  return !isSignerStatusRejected(status) && !isSignerStatusSigned(status)
}

export const InitialSituation = "Initial"

/**
 * It orchestrates the signing of a single digest by multiple signers.
 * It can provide internal visibility of the signing process, and it also
 * provides the internal signers with additional information about the
 * message being signed.
 */
export class Orchestrator {
  private observers: ((status: Status, metadata: Object) => void)[] = []
  private signers: SapientSigner[] = []

  private count = 0

  constructor(signers: (ethers.Signer | SapientSigner)[], public tag: string = Orchestrator.randomTag()) {
    this.setSigners(signers)
  }

  private static randomTag(): string {
    return `default-${ethers.utils.hexlify(ethers.utils.randomBytes(8)).slice(2)}`
  }

  private pullId(): string {
    return `${this.tag}-${this.count++}`
  }

  setSigners(signers: (ethers.Signer | SapientSigner)[]) {
    this.signers = signers.map((s) => isSapientSigner(s) ? s : new SignerWrapper(s))
  }

  async getSigners(): Promise<string[]> {
    return Promise.all(this.signers.map(async (s) => s.getAddress()))
  }

  subscribe(observer: (status: Status, metadata: Object) => void): () => void {
    this.observers.push(observer)
    return () => { this.observers = this.observers.filter((o) => o !== observer) }
  }

  private async notifyObservers(id: string, status: Status, metadata: Object) {
    await Promise.all([
      ...this.signers.map(async (signer) => signer.notifyStatusChange(id, status, metadata)),
      ...this.observers.map(async (observer) => observer(status, metadata))
    ])
  }

  signMessage(
    message: ethers.BytesLike,
    metadata: Object,
    callback?: (
      status: Status,
      onNewMetadata: (metadata: Object) => void
    ) => boolean
  ): Promise<Status> {
    const id = this.pullId()

    return new Promise(async (resolve) => {
      const status: Status = { ended: false, message, signers: {} }
      let lastMetadata = metadata

      const onNewMetadata = (newMetadata: Object) => {
        lastMetadata = newMetadata
        this.notifyObservers(id, status, lastMetadata)
      }

      const onStatusUpdate = () => {
        try {
          this.notifyObservers(id, status, lastMetadata)

          const pending = Object.entries(status.signers).filter(([_, s]) => isSignerStatusPending(s))
          if ((callback && callback(status, onNewMetadata)) || pending.length === 0) {
            status.ended = true
            resolve(status)
            this.notifyObservers(id, status, lastMetadata)
            return
          }
        } catch (e) {
          console.error("Error while notifying observers", e)
        }
      }

      // build callbacks object
      const accepted = await Promise.allSettled(this.signers.map(async (s) => {
        const saddr = await s.getAddress()
        status.signers[saddr] = { situation: InitialSituation }
        return s.requestSignature(id, message, metadata, {
          onSignature: (signature) => {
            const isEOA = s.isEOA()
            status.signers[saddr] = { signature, isEOA }
            onStatusUpdate()
          },
          onRejection: (error) => {
            status.signers[saddr] = { rejected: true, error }
            onStatusUpdate()
          },
          onStatus: (situation) => {
            status.signers[saddr] = { situation }
            onStatusUpdate()
          }
        })
      }))

      for (let i = 0; i < accepted.length; i++) {
        const signer = this.signers[i]
        const promise = accepted[i]

        if (promise.status === "rejected" || promise.value === false) {
          const prejected = promise as PromiseRejectedResult
          console.warn(`Signer ${await signer.getAddress()} rejected the request ${prejected.reason}`)
          status.signers[await signer.getAddress()] = { rejected: true, error: prejected.reason.toString() }
        }
      }

      onStatusUpdate()
    })
  }
}
