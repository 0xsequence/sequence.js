import { Address } from '@0xsequence/wallet-primitives'
import { Hex, Bytes } from 'ox'
import * as Db from '../../dbs/index.js'
import * as Identity from '@0xsequence/identity-instrument'
import { Signatures } from '../signatures.js'
import { BaseSignatureRequest } from '../types/signature-request.js'
import { IdentitySigner, toIdentityAuthKey } from '../../identity/signer.js'

export const identityTypeToHex = (identityType?: Identity.IdentityType): Hex.Hex => {
  // Bytes4
  switch (identityType) {
    case Identity.IdentityType.Guest:
      return '0x00000000'
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
  constructor(
    private readonly nitro: Identity.IdentityInstrument,
    private readonly authKeys: Db.AuthKeys,
    private readonly signatures: Signatures,
    public readonly identityType: Identity.IdentityType,
  ) {}

  public onStatusChange(cb: () => void): () => void {
    return this.authKeys.addListener(cb)
  }

  protected async nitroCommitVerifier(challenge: Identity.Challenge) {
    await this.authKeys.delBySigner(undefined)
    const authKey = await this.getAuthKey(undefined)
    if (!authKey) {
      throw new Error('no-auth-key')
    }

    const res = await this.nitro.commitVerifier(toIdentityAuthKey(authKey), challenge)
    return res
  }

  protected async nitroCompleteAuth(challenge: Identity.Challenge) {
    const authKey = await this.getAuthKey(undefined)
    if (!authKey) {
      throw new Error('no-auth-key')
    }

    const res = await this.nitro.completeAuth(toIdentityAuthKey(authKey), challenge)

    authKey.identitySigner = Address.checksum(res.signer.address)
    authKey.expiresAt = new Date(Date.now() + 1000 * 60 * 3) // 3 minutes
    await this.authKeys.delBySigner(undefined)
    await this.authKeys.delBySigner(authKey.identitySigner)
    await this.authKeys.set(authKey)

    const signer = new IdentitySigner(this.nitro, authKey)
    return { signer, email: res.identity.email }
  }

  protected async sign(signer: IdentitySigner, request: BaseSignatureRequest) {
    const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload)
    await this.signatures.addSignature(request.id, {
      address: signer.address,
      signature,
    })
  }

  protected async getAuthKeySigner(address: Address.Checksummed): Promise<IdentitySigner | undefined> {
    const authKey = await this.getAuthKey(address)
    if (!authKey) {
      return undefined
    }
    return new IdentitySigner(this.nitro, authKey)
  }

  private async getAuthKey(signer: Address.Checksummed | undefined): Promise<Db.AuthKey | undefined> {
    let authKey = await this.authKeys.getBySigner(signer)
    if (!signer && !authKey) {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        false,
        ['sign', 'verify'],
      )
      const publicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey)
      authKey = {
        address: Hex.fromBytes(new Uint8Array(publicKey)),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
        privateKey: keyPair.privateKey,
      }
      await this.authKeys.set(authKey)
    }
    return authKey
  }
}
