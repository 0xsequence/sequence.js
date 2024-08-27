import { ethers } from 'ethers'
import { commons } from '@0xsequence/core'
import { isSapientSigner, SapientSigner } from './signers/signer'
import { SignerWrapper } from './signers/wrapper'

export type Status = {
  ended: boolean
  message: ethers.BytesLike
  signers: { [signer: string]: SignerStatus }
}

export enum SignerState {
  INITIAL,
  SIGNING,
  SIGNED,
  ERROR
}

export type SignerStatus =
  | { state: SignerState.INITIAL }
  | { state: SignerState.SIGNING; request: Promise<ethers.BytesLike> }
  | { state: SignerState.SIGNED; signature: ethers.BytesLike; suffix: ethers.BytesLike }
  | { state: SignerState.ERROR; error: any }

export function isSignerStatusPending(
  status?: SignerStatus
): status is undefined | { state: SignerState.INITIAL } | { state: SignerState.SIGNING; request: Promise<ethers.BytesLike> } {
  return status === undefined || status.state === SignerState.INITIAL || status.state === SignerState.SIGNING
}

export interface SignatureOrchestrator {
  getSigners(): Promise<string[]>

  signMessage(args: {
    candidates: string[]
    message: ethers.BytesLike
    metadata: object
    callback: (status: Status, onNewMetadata: (metadata: object) => void) => boolean
  }): Promise<Status>

  buildDeployTransaction(metadata: object): Promise<commons.transaction.TransactionBundle | undefined>

  predecorateSignedTransactions(metadata?: object): Promise<commons.transaction.SignedTransactionBundle[]>

  decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    metadata?: object
  ): Promise<commons.transaction.IntendedTransactionBundle>
}

/**
 * Orchestrates actions of collective signers.
 * This includes the signing of a single digests and transactions by multiple signers.
 * It can provide internal visibility of the signing process, and it also
 * provides the internal signers with additional information about the
 * message being signed. Transaction decoration can be used to ensure on-chain state
 * is correctly managed during the signing process.
 */
export class Orchestrator {
  private observers: ((status: Status, metadata: object) => void)[] = []
  private signers: SapientSigner[] = []

  private count = 0

  constructor(
    signers: (ethers.Signer | SapientSigner)[],
    public tag: string = Orchestrator.randomTag()
  ) {
    this.setSigners(signers)
  }

  private static randomTag(): string {
    return `default-${ethers.hexlify(ethers.randomBytes(8)).slice(2)}`
  }

  private pullId(): string {
    return `${this.tag}-${this.count++}`
  }

  setSigners(signers: (ethers.Signer | SapientSigner)[]) {
    this.signers = signers.map(s => (isSapientSigner(s) ? s : new SignerWrapper(s)))
  }

  async getSigners(): Promise<string[]> {
    return Promise.all(this.signers.map(async s => s.getAddress()))
  }

  subscribe(observer: (status: Status, metadata: object) => void): () => void {
    this.observers.push(observer)
    return () => {
      this.observers = this.observers.filter(o => o !== observer)
    }
  }

  private async notifyObservers(id: string, status: Status, metadata: object) {
    await Promise.all([
      ...this.signers.map(async signer => signer.notifyStatusChange(id, status, metadata)),
      ...this.observers.map(async observer => observer(status, metadata))
    ])
  }

  async buildDeployTransaction(metadata: object): Promise<commons.transaction.TransactionBundle | undefined> {
    let bundle: commons.transaction.TransactionBundle | undefined
    for (const signer of this.signers) {
      const newBundle = await signer.buildDeployTransaction(metadata)
      if (bundle === undefined) {
        // Use first bundle as base
        bundle = newBundle
      } else if (newBundle?.transactions) {
        // Combine deploy transactions
        bundle.transactions = newBundle.transactions.concat(bundle.transactions)
      }
    }
    return bundle
  }

  async predecorateSignedTransactions(metadata?: object): Promise<commons.transaction.SignedTransactionBundle[]> {
    const output: commons.transaction.SignedTransactionBundle[] = []
    for (const signer of this.signers) {
      output.push(...(await signer.predecorateSignedTransactions(metadata ?? {})))
    }
    return output
  }

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    metadata?: object
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    for (const signer of this.signers) {
      bundle = await signer.decorateTransactions(bundle, metadata ?? {})
    }
    return bundle
  }

  signMessage(args: {
    candidates?: string[]
    message: ethers.BytesLike
    metadata?: object
    callback?: (status: Status, onNewMetadata: (metadata: object) => void) => boolean
  }): Promise<Status> {
    const id = this.pullId()

    return new Promise(async resolve => {
      const { message, metadata, callback, candidates } = args
      const status: Status = { ended: false, message, signers: {} }
      let lastMetadata = metadata ?? {}

      const onNewMetadata = (newMetadata: object) => {
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
          console.error('Error while notifying observers', e)
        }
      }

      // we only call signers that are found in `candidates`
      // if `candidates` is undefined, we call all signers
      let signers = this.signers
      if (candidates) {
        const addresses = await Promise.all(this.signers.map(async s => s.getAddress()))
        signers = this.signers.filter((_, i) => candidates.includes(addresses[i]))
      }

      // build callbacks object
      const accepted = await Promise.allSettled(
        signers.map(async s => {
          const saddr = await s.getAddress()

          status.signers[saddr] = {
            state: SignerState.SIGNING,
            request: s
              .sign(message, metadata ?? {})
              .then(signature => {
                const suffix = s.suffix()
                status.signers[saddr] = { state: SignerState.SIGNED, signature, suffix }
                onStatusUpdate()
                return signature
              })
              .catch(error => {
                status.signers[saddr] = { state: SignerState.ERROR, error }
                onStatusUpdate()
                throw error
              })
          }
        })
      )

      for (let i = 0; i < accepted.length; i++) {
        const signer = this.signers[i]
        const promise = accepted[i]

        if (promise.status === 'rejected') {
          const address = await signer.getAddress()
          console.warn(`signer ${address} rejected the request: ${promise.reason}`)
          status.signers[address] = {
            state: SignerState.ERROR,
            error: new Error(`signer ${address} rejected the request: ${promise.reason}`)
          }
        }
      }

      onStatusUpdate()
    })
  }
}
