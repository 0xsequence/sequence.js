import { IdentityType } from './clients/intent.gen'
import { ethers } from 'ethers'
import { jwtDecode } from 'jwt-decode'

export interface ChallengeIntentParams {
  identityType: IdentityType
  verifier: string
  answer?: string
}

export abstract class Challenge {
  public abstract getIntentParams(): ChallengeIntentParams
  public abstract withAnswer(answer: string): Challenge
}

export class GuestChallenge extends Challenge {
  constructor(
    readonly sessionId: string,
    readonly challenge: string
  ) {
    super()
  }

  getIntentParams(): ChallengeIntentParams {
    const answer = ethers.id(this.challenge + this.sessionId)
    return {
      identityType: IdentityType.Guest,
      verifier: this.sessionId,
      answer
    }
  }

  withAnswer(answer: string): Challenge {
    return this
  }
}

export class EmailChallenge extends Challenge {
  private hashedAnswer?: string

  constructor(
    readonly email: string,
    readonly sessionId: string,
    readonly challenge: string
  ) {
    super()
  }

  getIntentParams(): ChallengeIntentParams {
    return {
      identityType: IdentityType.Email,
      verifier: `${this.email};${this.sessionId}`,
      answer: this.hashedAnswer
    }
  }

  setAnswer(answer: string): void {
    this.hashedAnswer = ethers.id(this.challenge + answer)
  }

  withAnswer(answer: string) {
    const challenge = new EmailChallenge(this.email, this.sessionId, this.challenge)
    challenge.setAnswer(answer)
    return challenge
  }
}

export class IdTokenChallenge extends Challenge {
  constructor(readonly idToken: string) {
    super()
  }

  getIntentParams(): ChallengeIntentParams {
    const decoded = jwtDecode(this.idToken)
    const idTokenHash = ethers.id(this.idToken)
    return {
      identityType: IdentityType.OIDC,
      verifier: `${idTokenHash};${decoded.exp}`,
      answer: this.idToken
    }
  }

  withAnswer() {
    return this
  }
}

export class StytchChallenge extends IdTokenChallenge {
  constructor(readonly idToken: string) {
    super(idToken)
  }

  getIntentParams(): ChallengeIntentParams {
    return {
      ...super.getIntentParams(),
      identityType: IdentityType.Stytch
    }
  }
}

export class PlayFabChallenge extends Challenge {
  constructor(
    readonly titleId: string,
    readonly sessionTicket: string
  ) {
    super()
  }

  getIntentParams(): ChallengeIntentParams {
    const ticketHash = ethers.id(this.sessionTicket)
    return {
      identityType: IdentityType.PlayFab,
      verifier: `${this.titleId}|${ticketHash}`,
      answer: this.sessionTicket
    }
  }

  withAnswer() {
    return this
  }
}

export class XAuthChallenge extends Challenge {
  constructor(
    readonly accessToken: string
  ) {
    super()
  }

  getIntentParams(): ChallengeIntentParams {
    const accessTokenHash = ethers.id(this.accessToken)
    return {
      identityType: IdentityType.Twitter,
      verifier: accessTokenHash,
      answer: this.accessToken
    }
  }

  withAnswer() {
    return this
  }
}
