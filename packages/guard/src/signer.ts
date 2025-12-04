import { Account } from '@0xsequence/account'
import { commons, universal } from '@0xsequence/core'
import { signers, Status } from '@0xsequence/signhub'
import { encodeTypedDataDigest, TypedData } from '@0xsequence/utils'
import { ethers } from 'ethers'
import { AuthMethodsReturn, Guard, RecoveryCode as GuardRecoveryCode } from './guard.gen'

export class GuardSigner implements signers.SapientSigner {
  private guard: Guard

  constructor(
    public readonly address: string,
    public readonly url: string,
    public readonly appendSuffix: boolean = false,
    public readonly projectAccessKey?: string
  ) {
    this.guard = new Guard(url, this._fetch)
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers: { [key: string]: any } = {}

    const projectAccessKey = this.projectAccessKey

    if (projectAccessKey && projectAccessKey.length > 0) {
      headers['X-Access-Key'] = projectAccessKey
    }

    // before the request is made
    init!.headers = { ...init!.headers, ...headers }

    return fetch(input, init)
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

  async sign(message: ethers.BytesLike, metadata: object): Promise<ethers.BytesLike> {
    if (!commons.isWalletSignRequestMetadata(metadata)) {
      throw new Error('expected sequence signature request metadata')
    }

    const guardTotpCode = (metadata as { guardTotpCode?: string }).guardTotpCode

    // Building auxData, notice: this uses the old v1 format
    // TODO: We should update the guard API so we can pass the metadata directly
    const coder = universal.genericCoderFor(metadata.config.version)
    const { encoded } = coder.signature.encodeSigners(metadata.config, metadata.parts ?? new Map(), [], metadata.chainId)

    return (
      await this.guard.signWith({
        signer: this.address,
        request: {
          msg: ethers.hexlify(message),
          auxData: this.packMsgAndSig(metadata.address, metadata.digest, encoded, metadata.chainId),
          chainId: Number(metadata.chainId)
        },
        token: guardTotpCode ? { id: AuthMethod.TOTP, token: guardTotpCode } : undefined
      })
    ).sig
  }

  notifyStatusChange(_id: string, _status: Status, _metadata: object): void {}

  async getAuthMethods(proof: OwnershipProof): Promise<{ methods: AuthMethod[]; active: boolean }> {
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
          signature: signedProof.signature,
          chainId: 1
        }
      })
    }

    return { ...response, methods: response.methods.map(parseAuthMethod) }
  }

  async setPin(pin: string | undefined, proof: AuthUpdateProof): Promise<void> {
    const signedProof = await signAuthUpdateProof(proof)

    if (pin === undefined) {
      await this.guard.resetPIN(
        { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature, chainId: 1 },
        { Authorization: `BEARER ${proof.jwt}` }
      )
    } else {
      await this.guard.setPIN(
        { pin, timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature, chainId: 1 },
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
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature, chainId: 1 },
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
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature, chainId: 1 },
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
          signature: signedProof.signature,
          chainId: 1
        }
      })
    }
  }

  async getRecoveryCodes(proof: AuthUpdateProof): Promise<RecoveryCode[]> {
    const signedProof = await signAuthUpdateProof(proof)

    const { codes } = await this.guard.recoveryCodes(
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature, chainId: 1 },
      { Authorization: `BEARER ${proof.jwt}` }
    )

    return codes
  }

  async resetRecoveryCodes(proof: AuthUpdateProof): Promise<RecoveryCode[]> {
    const signedProof = await signAuthUpdateProof(proof)

    const { codes } = await this.guard.resetRecoveryCodes(
      { timestamp: signedProof.timestamp.getTime(), signature: signedProof.signature, chainId: 1 },
      { Authorization: `BEARER ${proof.jwt}` }
    )

    return codes
  }

  private packMsgAndSig(address: string, msg: ethers.BytesLike, sig: ethers.BytesLike, chainId: ethers.BigNumberish): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bytes', 'bytes'], [address, chainId, msg, sig])
  }

  suffix(): ethers.BytesLike {
    return new Uint8Array(this.appendSuffix ? [3] : [])
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

export type SignedOwnershipProof = {
  walletAddress: string
  timestamp: Date
  signerAddress: string
  signature: string
}

export type OwnershipProof =
  | SignedOwnershipProof
  | { jwt: string }
  | {
      walletAddress: string
      signer: ethers.Signer | signers.SapientSigner
    }

export function isSignedOwnershipProof(proof: OwnershipProof): proof is SignedOwnershipProof {
  return 'signerAddress' in proof && typeof proof.signerAddress === 'string'
}

export async function signOwnershipProof(proof: Exclude<OwnershipProof, { jwt: string }>): Promise<SignedOwnershipProof> {
  if (isSignedOwnershipProof(proof)) {
    return proof
  } else {
    const signer = signers.isSapientSigner(proof.signer) ? proof.signer : new signers.SignerWrapper(proof.signer)
    const signerAddress = await signer.getAddress()
    const timestamp = new Date()
    const typedData = getOwnershipProofTypedData(proof.walletAddress, timestamp)
    const digest = encodeTypedDataDigest(typedData)

    return {
      walletAddress: proof.walletAddress,
      timestamp,
      signerAddress,
      signature: ethers.hexlify(await signer.sign(digest, {}))
    }
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
      wallet: ethers.getAddress(wallet),
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

const domain: ethers.TypedDataDomain = {
  name: 'Sequence Guard',
  version: '1',
  chainId: 1
}

function toUTCString(date: Date): string {
  return date.toUTCString().replace('GMT', 'UTC')
}
