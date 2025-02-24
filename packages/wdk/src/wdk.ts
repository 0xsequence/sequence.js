import { Challenge, IdTokenChallenge } from './challenge'
import { IdentityInstrument } from './nitro'
import { AuthKey } from './authkey'
import { IdentitySigner } from './signer'
import { getDefaultSecureStoreBackend } from './secure-store'

export class Wdk {
  constructor(
    readonly ecosystemId: string,
    readonly nitro: IdentityInstrument,
  ) {}

  public async loginWithIdToken(issuer: string, audience: string, idToken: string) {
    const challenge = new IdTokenChallenge(issuer, audience, idToken)
    await this.initiateAuth(challenge)
    return await this.completeAuth(challenge)
  }

  public async getSigner() {
    const authKey = await this.getAuthKey()
    if (!authKey.identitySigner) {
      throw new Error('No signer address found')
    }
    return new IdentitySigner(this.ecosystemId, this.nitro, authKey)
  }

  private async initiateAuth(challenge: Challenge) {
    const authKey = await this.getAuthKey()
    const challengeParams = challenge.getParams()
    const params = {
      ecosystemId: this.ecosystemId,
      authKey: authKey.toProto(),
      ...challengeParams,
      answer: undefined,
    }
    const res = await this.nitro.initiateAuth({ params })
    return res.challenge
  }

  private async completeAuth(challenge: Challenge) {
    const authKey = await this.getAuthKey()
    const challengeParams = challenge.getParams()
    const params = {
      answer: '',
      ...challengeParams,
      ecosystemId: this.ecosystemId,
      authKey: authKey.toProto(),
    }
    const res = await this.nitro.registerAuth({ params })
    await authKey.setIdentitySigner(res.signer as `0x${string}`)
    return new IdentitySigner(this.ecosystemId, this.nitro, authKey)
  }

  private async getAuthKey() {
    const backend = getDefaultSecureStoreBackend()
    if (!backend) {
      throw new Error('No secure store backend available')
    }
    const authKey = await AuthKey.fromStorage(backend)
    if (!authKey) {
      return await AuthKey.createRandom(backend)
    }
    return authKey
  }
}
