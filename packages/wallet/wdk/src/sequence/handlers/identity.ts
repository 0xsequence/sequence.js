import { Hex } from 'ox'
import * as Db from '../../dbs'
import * as Identity from '../../identity'
import { Signatures } from '../signatures'
import { BaseSignatureRequest } from '../types'

export class IdentityHandler {
  constructor(
    private readonly nitro: Identity.IdentityInstrument,
    private readonly authKeys: Db.AuthKeys,
    private readonly signatures: Signatures,
  ) {}

  public onStatusChange(cb: () => void): () => void {
    return this.authKeys.addListener(cb)
  }

  protected async nitroCommitVerifier(challenge: Identity.Challenge) {
    await this.authKeys.delBySigner('')
    const authKey = await this.getAuthKey('')
    if (!authKey) {
      throw new Error('no-auth-key')
    }

    const res = await this.nitro.commitVerifier({
      params: {
        ...challenge.getCommitParams(),
        authKey: {
          publicKey: authKey.address,
          keyType: Identity.KeyType.P256R1,
        },
      },
    })
    return res
  }

  protected async nitroCompleteAuth(challenge: Identity.Challenge) {
    const authKey = await this.getAuthKey('')
    if (!authKey) {
      throw new Error('no-auth-key')
    }

    const res = await this.nitro.completeAuth({
      params: {
        ...challenge.getCompleteParams(),
        authKey: {
          publicKey: authKey.address,
          keyType: Identity.KeyType.P256R1,
        },
      },
    })

    authKey.identitySigner = res.signer
    await this.authKeys.delBySigner('')
    await this.authKeys.set(authKey)

    const signer = new Identity.IdentitySigner(this.nitro, authKey)
    return signer
  }

  protected async sign(signer: Identity.IdentitySigner, request: BaseSignatureRequest) {
    const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload)
    await this.signatures.addSignature(request.id, {
      address: signer.address,
      signature,
    })
    await this.authKeys.delBySigner(signer.address)
  }

  protected async getAuthKeySigner(address: string): Promise<Identity.IdentitySigner | undefined> {
    const authKey = await this.getAuthKey(address)
    if (!authKey) {
      return undefined
    }
    return new Identity.IdentitySigner(this.nitro, authKey)
  }

  private async getAuthKey(signer: string): Promise<Db.AuthKey | undefined> {
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
        identitySigner: '',
        expiresAt: new Date(Date.now() + 1000 * 60 * 3), // 3 minutes
        privateKey: keyPair.privateKey,
      }
      await this.authKeys.set(authKey)
    }
    return authKey
  }
}
