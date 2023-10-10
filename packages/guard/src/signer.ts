import { Account } from '@0xsequence/account'
import { commons, universal } from '@0xsequence/core'
import { signers, Status } from '@0xsequence/signhub'
import { encodeTypedDataDigest, TypedData } from '@0xsequence/utils'
import { BytesLike, ethers, TypedDataDomain } from 'ethers'
import { AuthMethodsReturn, Guard, RecoveryCode as GuardRecoveryCode } from './guard.gen'

const fetch = typeof global === 'object' ? global.fetch : window.fetch

export class GuardSigner implements signers.SapientSigner {
  private guard: Guard
  private requests: Map<
    string,
    {
      lastAttempt?: string
      onSignature: (signature: BytesLike) => void
      onRejection: (error: string) => void
      onStatus: (situation: string) => void
    }
  > = new Map()

  constructor(
    public readonly address: string,
    public readonly url: string,
    public readonly appendSuffix: boolean = false,
    private readonly onError?: (err: Error) => void
  ) {
    this.guard = new Guard(url, fetch)
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  async buildDeployTransaction(_metadata: object): Promise<commons.transaction.TransactionBundle | undefined> {
    return undefined
  }

  async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
    return []
  }

  async decorateTransactions(
    bundle: commons.transaction.IntendedTransactionBundle,
    _metadata: object
  ): Promise<commons.transaction.IntendedTransactionBundle> {
    return bundle
  }

  async requestSignature(
    id: string,
    _message: BytesLike,
    metadata: object,
    callbacks: {
      onSignature: (signature: BytesLike) => void
      onRejection: (error: string) => void
      onStatus: (situation: string) => void
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

  notifyStatusChange(id: string, status: Status, metadata: object): void {
    if (!this.requests.has(id)) return

    if (!commons.isWalletSignRequestMetadata(metadata)) {
      this.requests.get(id)!.onRejection('Expected Sequence-like metadata (status update)')
      return
    }

    this.evaluateRequest(id, status.message, status, metadata)
  }

  async getAuthMethods(proof: OwnershipProof): Promise<AuthMethod[]> {
    let response: AuthMethodsReturn

    if ('jwt' in proof) {
      response = await this.guard.authMethods({}, { Authorization: `BEARER ${proof.jwt}` })
    } else {
      const signedProof = await signOwnershipProof(proof)

      response = await this.guard.authMethods({
        proof: {
          wallet: signedProof.walletAddress,
          timestamp: signedProof.timestamp.getTime(),
          signer: signedProof.signerAddress,
          signature: signedProof.signature
        }
      })
    }

    return response.methods.map(parseAuthMethod)
  }

  async setPin(pin: string | undefined, proof: AuthUpdateProof): Promise<void> {
    const signedProof = await signAuthUpdateProof(proof)

    if (pin === undefined) {
      await this.guard.resetPIN(
        { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature },
        { Authorization: `BEARER ${proof.jwt}` }
      )
    } else {
      await this.guard.setPIN(
        { pin, timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature },
        { Authorization: `BEARER ${proof.jwt}` }
      )
    }
  }

  resetPin(proof: AuthUpdateProof): Promise<void> {
    return this.setPin(undefined, proof)
  }

  async createTotp(proof: AuthUpdateProof): Promise<URL> {
    const signedProof = await signAuthUpdateProof(proof)

    const { uri } = await this.guard.createTOTP(
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature },
      { Authorization: `BEARER ${proof.jwt}` }
    )

    return new URL(uri)
  }

  async commitTotp(token: string, jwt: string): Promise<RecoveryCode[]> {
    const { codes } = await this.guard.commitTOTP({ token }, { Authorization: `BEARER ${jwt}` })
    return codes
  }

  async resetTotp(proof: AuthUpdateProof): Promise<void> {
    const signedProof = await signAuthUpdateProof(proof)

    await this.guard.resetTOTP(
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature },
      { Authorization: `BEARER ${proof.jwt}` }
    )
  }

  async reset2fa(recoveryCode: string, proof: OwnershipProof): Promise<void> {
    if ('jwt' in proof) {
      await this.guard.reset2FA({ code: recoveryCode }, { Authorization: `BEARER ${proof.jwt}` })
    } else {
      const signedProof = await signOwnershipProof(proof)

      await this.guard.reset2FA({
        code: recoveryCode,
        proof: {
          wallet: signedProof.walletAddress,
          timestamp: signedProof.timestamp.getTime(),
          signer: signedProof.signerAddress,
          signature: signedProof.signature
        }
      })
    }
  }

  async getRecoveryCodes(proof: AuthUpdateProof): Promise<RecoveryCode[]> {
    const signedProof = await signAuthUpdateProof(proof)

    const { codes } = await this.guard.recoveryCodes(
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature },
      { Authorization: `BEARER ${proof.jwt}` }
    )

    return codes
  }

  async resetRecoveryCodes(proof: AuthUpdateProof): Promise<RecoveryCode[]> {
    const signedProof = await signAuthUpdateProof(proof)

    const { codes } = await this.guard.resetRecoveryCodes(
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature },
      { Authorization: `BEARER ${proof.jwt}` }
    )

    return codes
  }

  private packMsgAndSig(address: string, msg: BytesLike, sig: BytesLike, chainId: ethers.BigNumberish): string {
    return ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes', 'bytes'], [address, chainId, msg, sig])
  }

  private keyOfRequest(signer: string, msg: BytesLike, auxData: BytesLike, chainId: ethers.BigNumberish): string {
    return ethers.utils.solidityKeccak256(['address', 'uint256', 'bytes', 'bytes'], [signer, chainId, msg, auxData])
  }

  private async evaluateRequest(
    id: string,
    message: BytesLike,
    _: Status,
    metadata: commons.WalletSignRequestMetadata & { guardTotpCode?: string }
  ): Promise<void> {
    // Building auxData, notice: this uses the old v1 format
    // TODO: We should update the guard API so we can pass the metadata directly
    const coder = universal.genericCoderFor(metadata.config.version)
    const { encoded } = coder.signature.encodeSigners(metadata.config, metadata.parts ?? new Map(), [], metadata.chainId)

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
        },
        token: metadata.guardTotpCode
          ? {
              id: AuthMethod.TOTP,
              token: metadata.guardTotpCode
            }
          : undefined
      })

      if (ethers.utils.arrayify(result.sig).length !== 0) {
        this.requests.get(id)!.onSignature(result.sig)
        this.requests.delete(id)
      }
    } catch (e) {
      // The guard signer may reject the request for a number of reasons
      // like for example, if it's being the first signer (it waits for other signers to sign first)
      // We always forward the error here and filter on client side.
      this.onError?.(e)
    }
  }

  suffix(): BytesLike {
    return this.appendSuffix ? [3] : []
  }
}

export type RecoveryCode = GuardRecoveryCode

export enum AuthMethod {
  PIN = 'PIN',
  TOTP = 'TOTP'
}

function parseAuthMethod(method: string): AuthMethod {
  switch (method) {
    case AuthMethod.PIN:
    case AuthMethod.TOTP:
      return method
    default:
      throw new Error(`unknown auth method '${method}'`)
  }
}

export type OwnershipProof =
  | { jwt: string }
  | {
      walletAddress: string
      timestamp: Date
      signerAddress: string
      signature: string
    }
  | {
      walletAddress: string
      signer: ethers.Signer | signers.SapientSigner
    }

function isSignedOwnershipProof(
  proof: OwnershipProof
): proof is { walletAddress: string; timestamp: Date; signerAddress: string; signature: string } {
  return 'signerAddress' in proof && typeof proof.signerAddress === 'string'
}

async function signOwnershipProof(
  proof: Exclude<OwnershipProof, { jwt: string }>
): Promise<{ walletAddress: string; timestamp: Date; signerAddress: string; signature: string }> {
  if (isSignedOwnershipProof(proof)) {
    return proof
  } else {
    const signer = signers.isSapientSigner(proof.signer) ? proof.signer : new signers.SignerWrapper(proof.signer)
    const signerAddress = await signer.getAddress()
    const timestamp = new Date()
    const typedData = getOwnershipProofTypedData(proof.walletAddress, timestamp)
    const digest = encodeTypedDataDigest(typedData)
    const randomId = ethers.utils.hexlify(ethers.utils.randomBytes(32))

    return new Promise((resolve, reject) =>
      signer.requestSignature(
        randomId,
        digest,
        {},
        {
          onSignature(signature) {
            resolve({
              walletAddress: proof.walletAddress,
              timestamp,
              signerAddress,
              signature: ethers.utils.hexlify(signature)
            })
          },
          onRejection: reject,
          onStatus(_situation) {}
        }
      )
    )
  }
}

export type AuthUpdateProof = { jwt: string } & ({ timestamp: Date; signature: string } | { wallet: Account })

async function signAuthUpdateProof(proof: AuthUpdateProof): Promise<{ jwt: string; timestamp: Date; signature: string }> {
  if ('wallet' in proof) {
    const timestamp = new Date()
    const typedData = getAuthUpdateProofTypedData(timestamp)

    const signature = await proof.wallet.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message,
      typedData.domain.chainId ?? 1,
      'eip6492'
    )

    return { jwt: proof.jwt, timestamp, signature }
  } else {
    return proof
  }
}

export function getOwnershipProofTypedData(wallet: string, timestamp: Date): TypedData {
  return {
    domain,
    types: {
      AuthMethods: [
        { name: 'wallet', type: 'address' },
        { name: 'timestamp', type: 'string' }
      ]
    },
    message: {
      wallet: ethers.utils.getAddress(wallet),
      timestamp: toUTCString(timestamp)
    }
  }
}

export function getAuthUpdateProofTypedData(timestamp: Date): TypedData {
  return {
    domain,
    types: {
      AuthUpdate: [{ name: 'timestamp', type: 'string' }]
    },
    message: {
      timestamp: toUTCString(timestamp)
    }
  }
}

const domain: TypedDataDomain = {
  name: 'Sequence Guard',
  version: '1',
  chainId: 1
}

function toUTCString(date: Date): string {
  return date.toUTCString().replace('GMT', 'UTC')
}
