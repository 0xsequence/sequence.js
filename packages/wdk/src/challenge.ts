import { Hash, Hex } from 'ox'
import { jwtDecode } from 'jwt-decode'
import { IdentityType } from './nitro'

export interface ChallengeParams {
  identityType: IdentityType
  verifier: string
  answer?: string
}

export abstract class Challenge {
  public abstract getParams(): ChallengeParams
  public abstract withAnswer(answer: string): Challenge
}

export class IdTokenChallenge extends Challenge {
  constructor(
    readonly issuer: string,
    readonly audience: string,
    readonly idToken: string,
  ) {
    super()
  }

  public getParams(): ChallengeParams {
    const decoded = jwtDecode(this.idToken)
    const idTokenHash = Hash.keccak256(new TextEncoder().encode(this.idToken))
    return {
      identityType: IdentityType.OIDC,
      verifier: [this.issuer, this.audience, Hex.fromBytes(idTokenHash), decoded.exp].join('|'),
      answer: this.idToken,
    }
  }

  public withAnswer(_answer: string): IdTokenChallenge {
    return this
  }
}
