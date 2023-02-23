
import { signers, Status } from '@0xsequence/signhub'
import { BytesLike, ethers } from 'ethers'
import { Guard } from './guard.gen'
import { commons, universal } from '@0xsequence/core'

export class GuardSigner implements signers.SapientSigner {
  private guard: Guard
  private requests: Map<string, {
    lastAttempt?: string;
    onSignature: (signature: BytesLike) => void;
    onRejection: (error: string) => void;
    onStatus: (situation: string) => void;
  }> = new Map()

  constructor(
    public readonly address: string,
    public readonly url: string,
    public readonly appendSuffix: boolean = false
  ) {
    this.guard = new Guard(url, global.fetch)
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  async requestSignature(
    id: string,
    _message: BytesLike,
    metadata: Object,
    callbacks: {
      onSignature: (signature: BytesLike) => void;
      onRejection: (error: string) => void;
      onStatus: (situation: string) => void;
    }
  ): Promise<boolean> {
    if (!commons.isWalletSignRequestMetadata(metadata)) {
      callbacks.onRejection('Expected Sequence-like metadata')
    } else {
      // Queue the request first, this method only does that
      // the requesting to the API is later handled on every status change
      this.requests.set(id, callbacks)
    }

    return true
  }

  notifyStatusChange(
    id: string,
    status: Status,
    metadata: Object
  ): void {
    if (!this.requests.has(id)) return

    if (!commons.isWalletSignRequestMetadata(metadata)) {
      this.requests.get(id)!.onRejection('Expected Sequence-like metadata (status update)')
      return
    }

    this.evaluateRequest(id, status.message, status, metadata)
  }

  private packMsgAndSig(address: string, msg: BytesLike, sig: BytesLike, chainId: ethers.BigNumberish): string {
    return ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'bytes', 'bytes'],
      [address, chainId, msg, sig]
    )
  }

  private keyOfRequest(signer: string, msg: BytesLike, auxData: BytesLike, chainId: ethers.BigNumberish): string {
    return ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'bytes', 'bytes'],
      [signer, chainId, msg, auxData]
    )
  }

  private async evaluateRequest(id: string, message: BytesLike, _: Status, metadata: commons.WalletSignRequestMetadata): Promise<void> {
    // Building auxData, notice: this uses the old v1 format
    // TODO: We should update the guard API so we can pass the metadata directly
    const coder = universal.genericCoderFor(metadata.config.version)
    const { encoded } = coder.signature.encodeSigners(metadata.config, metadata.signatureParts ?? new Map(), [], metadata.chainId)

    try {
      const key = this.keyOfRequest(this.address, message, encoded, metadata.chainId)
      const lastAttempt = this.requests.get(id)?.lastAttempt
      if (lastAttempt === key) {
        return
      }

      this.requests.get(id)!.lastAttempt = key

      const result = await this.guard.signWith({
        signer: this.address,
        request: {
          msg: ethers.utils.hexlify(message),
          auxData: this.packMsgAndSig(metadata.address, metadata.digest, encoded, metadata.chainId),
          chainId: ethers.BigNumber.from(metadata.chainId).toNumber() // TODO: This should be a string (in the API)
        }
      })

      if (ethers.utils.arrayify(result.sig).length !== 0) {
        this.requests.get(id)!.onSignature(result.sig)
        this.requests.delete(id)
      }
    } catch (e) {
      // The guard signer may reject the request for a number of reasons
      // like for example, if it's being the first signer (it waits for other signers to sign first)
      // for now we ignore all errors, but we should probably handle them
      // TODO: Filter real errors from control flow errors
    }
  }

  suffix(): BytesLike {
    return this.appendSuffix ? [ 3 ] : []
  }
}
