import { Hex, Bytes } from 'ox'
import * as Db from '../../dbs/index.js'
import * as Identity from '@0xsequence/identity-instrument'
import { Signatures } from '../signatures.js'
import { BaseSignatureRequest } from '../types/signature-request.js'
import { IdentitySigner, toIdentityAuthKey } from '../../identity/signer.js'
import { resolveWdkEnv, type WdkEnv } from '../../env.js'

export const identityTypeToHex = (identityType?: Identity.IdentityType): Hex.Hex => {
  // Bytes4
  switch (identityType) {
    case Identity.IdentityType.Email:
      return '0x00000001'
    case Identity.IdentityType.OIDC:
      return '0x00000002'
    default:
      // Unknown identity type
      return '0xffffffff'
  }
}

export class IdentityHandler {
  protected readonly env: WdkEnv

  constructor(
    private readonly nitro: Identity.IdentityInstrument,
    private readonly authKeys: Db.AuthKeys,
    private readonly signatures: Signatures,
    public readonly identityType: Identity.IdentityType,
    env?: WdkEnv,
  ) {
    this.env = resolveWdkEnv(env)
  }

  public onStatusChange(cb: () => void): () => void {
    return this.authKeys.addListener(cb)
  }

  protected async nitroCommitVerifier(challenge: Identity.Challenge) {
    await this.authKeys.delBySigner('')
    const authKey = await this.getAuthKey('')
    if (!authKey) {
      throw new Error('no-auth-key')
    }

    const res = await this.nitro.commitVerifier(toIdentityAuthKey(authKey, this.env.crypto), challenge)
    return res
  }

  protected async nitroCompleteAuth(challenge: Identity.Challenge) {
    const authKey = await this.getAuthKey('')
    if (!authKey) {
      throw new Error('no-auth-key')
    }

    const res = await this.nitro.completeAuth(toIdentityAuthKey(authKey, this.env.crypto), challenge)

    authKey.identitySigner = res.signer.address
    authKey.expiresAt = new Date(Date.now() + 1000 * 60 * 3) // 3 minutes
    await this.authKeys.delBySigner('')
    await this.authKeys.delBySigner(authKey.identitySigner)
    await this.authKeys.set(authKey)

    const signer = new IdentitySigner(this.nitro, authKey, this.env.crypto)
    return { signer, email: res.identity.email }
  }

  protected async sign(signer: IdentitySigner, request: BaseSignatureRequest) {
    const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload)
    await this.signatures.addSignature(request.id, {
      address: signer.address,
      signature,
    })
  }

  protected async getAuthKeySigner(address: string): Promise<IdentitySigner | undefined> {
    const authKey = await this.getAuthKey(address)
    if (!authKey) {
      return undefined
    }
    return new IdentitySigner(this.nitro, authKey, this.env.crypto)
  }

  private async getAuthKey(signer: string): Promise<Db.AuthKey | undefined> {
    let authKey = await this.authKeys.getBySigner(signer)
    if (!signer && !authKey) {
      const crypto = this.env.crypto ?? (globalThis as any).crypto
      if (!crypto?.subtle) {
        throw new Error('crypto.subtle is not available')
      }
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        false,
        ['sign', 'verify'],
      )
      const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
      authKey = {
        address: Hex.fromBytes(new Uint8Array(publicKey)),
        identitySigner: '',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
        privateKey: keyPair.privateKey,
      }
      await this.authKeys.set(authKey)
    }
    return authKey
  }
}
