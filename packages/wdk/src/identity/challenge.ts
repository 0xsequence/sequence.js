import { Bytes, Hash, Hex } from 'ox'
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
    readonly redirectUri: string,
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
        redirect_uri: this.redirectUri,
      },
    }
  }

  public withAnswer(verifier: string, authCode: string): AuthCodePkceChallenge {
    const challenge = new AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri)
    challenge.verifier = verifier
    challenge.authCode = authCode
    return challenge
  }
}

export class OtpChallenge extends Challenge {
  private answer?: string

  constructor(
    readonly identityType: IdentityType,
    readonly verifier: string,
  ) {
    super()
  }

  public getParams(): ChallengeParams {
    return {
      authMode: AuthMode.OTP,
      identityType: this.identityType,
      verifier: this.verifier,
      answer: this.answer,
      metadata: {},
    }
  }

  public withAnswer(verifier: string, codeChallenge: string, otp: string): OtpChallenge {
    const challenge = new OtpChallenge(this.identityType, verifier)
    const answerHash = Hash.keccak256(Bytes.fromString(codeChallenge + otp))
    challenge.answer = Hex.fromBytes(answerHash)
    return challenge
  }
}
