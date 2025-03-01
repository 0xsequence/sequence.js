import { Hash, Hex } from 'ox'
import { jwtDecode } from 'jwt-decode'
import { IdentityType, AuthMode } from './nitro'

export interface ChallengeParams {
  authMode: AuthMode
  identityType: IdentityType
  verifier: string
  answer?: string
  metadata: { [key: string]: string }
}

export abstract class Challenge {
  public abstract getParams(): ChallengeParams
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
      authMode: AuthMode.IDToken,
      identityType: IdentityType.OIDC,
      verifier: Hex.fromBytes(idTokenHash),
      answer: this.idToken,
      metadata: {
        iss: this.issuer,
        aud: this.audience,
        exp: decoded.exp?.toString() ?? '',
      },
    }
  }
}

export class AuthCodePkceChallenge extends Challenge {
  private verifier?: string
  private authCode?: string

  constructor(
    readonly issuer: string,
    readonly audience: string,
  ) {
    super()
  }

  public getParams(): ChallengeParams {
    return {
      authMode: AuthMode.AuthCodePKCE,
      identityType: IdentityType.OIDC,
      verifier: this.verifier ?? '',
      answer: this.authCode ?? '',
      metadata: {
        iss: this.issuer,
        aud: this.audience,
      },
    }
  }

  public withAnswer(verifier: string, authCode: string): AuthCodePkceChallenge {
    const challenge = new AuthCodePkceChallenge(this.issuer, this.audience)
    challenge.verifier = verifier
    challenge.authCode = authCode
    return challenge
  }
}
