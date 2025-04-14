import { Bytes, Hash, Hex } from 'ox'
import { jwtDecode } from 'jwt-decode'
import { IdentityType, AuthMode } from './nitro'

export interface CommitChallengeParams {
  authMode: AuthMode
  identityType: IdentityType
  handle?: string
  signer?: string
  metadata: { [key: string]: string }
}

export interface CompleteChallengeParams {
  authMode: AuthMode
  identityType: IdentityType
  verifier: string
  answer: string
}

export abstract class Challenge {
  public abstract getCommitParams(): CommitChallengeParams
  public abstract getCompleteParams(): CompleteChallengeParams
}

export class IdTokenChallenge extends Challenge {
  private handle = ''
  private exp = ''

  constructor(
    readonly issuer: string,
    readonly audience: string,
    readonly idToken: string,
  ) {
    super()
    const decoded = jwtDecode(this.idToken)
    const idTokenHash = Hash.keccak256(new TextEncoder().encode(this.idToken))
    this.handle = Hex.fromBytes(idTokenHash)
    this.exp = decoded.exp?.toString() ?? ''
  }

  public getCommitParams(): CommitChallengeParams {
    return {
      authMode: AuthMode.IDToken,
      identityType: IdentityType.OIDC,
      handle: this.handle,
      metadata: {
        iss: this.issuer,
        aud: this.audience,
        exp: this.exp,
      },
    }
  }

  public getCompleteParams(): CompleteChallengeParams {
    return {
      authMode: AuthMode.IDToken,
      identityType: IdentityType.OIDC,
      verifier: this.handle,
      answer: this.idToken,
    }
  }
}

export class AuthCodePkceChallenge extends Challenge {
  private verifier?: string
  private authCode?: string
  private signer?: string

  constructor(
    readonly issuer: string,
    readonly audience: string,
    readonly redirectUri: string,
  ) {
    super()
  }

  public getCommitParams(): CommitChallengeParams {
    return {
      authMode: AuthMode.AuthCodePKCE,
      identityType: IdentityType.OIDC,
      signer: this.signer,
      metadata: {
        iss: this.issuer,
        aud: this.audience,
        redirect_uri: this.redirectUri,
      },
    }
  }

  public getCompleteParams(): CompleteChallengeParams {
    if (!this.verifier || !this.authCode) {
      throw new Error('AuthCodePkceChallenge is not complete')
    }

    return {
      authMode: AuthMode.AuthCodePKCE,
      identityType: IdentityType.OIDC,
      verifier: this.verifier,
      answer: this.authCode,
    }
  }

  public withSigner(signer: string): AuthCodePkceChallenge {
    const challenge = new AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri)
    challenge.verifier = this.verifier
    challenge.signer = signer
    return challenge
  }

  public withAnswer(verifier: string, authCode: string): AuthCodePkceChallenge {
    const challenge = new AuthCodePkceChallenge(this.issuer, this.audience, this.redirectUri)
    challenge.signer = this.signer
    challenge.verifier = verifier
    challenge.authCode = authCode
    return challenge
  }
}

export class OtpChallenge extends Challenge {
  private answer?: string
  private recipient?: string
  private signer?: string

  private constructor(readonly identityType: IdentityType) {
    super()
  }

  public static fromRecipient(identityType: IdentityType, recipient: string): OtpChallenge {
    const challenge = new OtpChallenge(identityType)
    challenge.recipient = recipient
    return challenge
  }

  public static fromSigner(identityType: IdentityType, signer: string): OtpChallenge {
    const challenge = new OtpChallenge(identityType)
    challenge.signer = signer
    return challenge
  }

  public getCommitParams(): CommitChallengeParams {
    if (!this.recipient && !this.signer) {
      throw new Error('OtpChallenge is not complete')
    }

    return {
      authMode: AuthMode.OTP,
      identityType: this.identityType,
      handle: this.recipient,
      signer: this.signer,
      metadata: {},
    }
  }

  public getCompleteParams(): CompleteChallengeParams {
    if (!this.answer || (!this.recipient && !this.signer)) {
      throw new Error('OtpChallenge is not complete')
    }

    return {
      authMode: AuthMode.OTP,
      identityType: this.identityType,
      verifier: this.recipient ?? this.signer ?? '',
      answer: this.answer,
    }
  }

  public withAnswer(codeChallenge: string, otp: string): OtpChallenge {
    const challenge = new OtpChallenge(this.identityType)
    challenge.recipient = this.recipient
    challenge.signer = this.signer
    const answerHash = Hash.keccak256(Bytes.fromString(codeChallenge + otp))
    challenge.answer = Hex.fromBytes(answerHash)
    return challenge
  }
}
