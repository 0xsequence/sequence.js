import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  UserLambdaValidationException
} from '@aws-sdk/client-cognito-identity-provider'

import { IdTokenIdentity } from './auth'

export class EmailAuth {
  private cognitoMemo: CognitoIdentityProviderClient

  constructor(
    public readonly region: string,
    public readonly clientId: string
  ) {}

  private cognito() {
    if (!this.cognitoMemo) {
      this.cognitoMemo = new CognitoIdentityProviderClient({
        region: this.region
      })
    }

    return this.cognitoMemo
  }

  private signUp(email: string) {
    email = email.toLowerCase().trim()
    return this.cognito().send(
      new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: 'aB1%' + getRandomString(14),
        UserAttributes: [{ Name: 'email', Value: email }]
      })
    )
  }

  private signIn(email: string) {
    email = email.toLowerCase().trim()
    return this.cognito().send(
      new InitiateAuthCommand({
        AuthFlow: 'CUSTOM_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email
        }
      })
    )
  }

  public async initiateAuth({ email }: { email: string }): Promise<{ email: string; instance: string }> {
    let res: InitiateAuthCommandOutput
    email = email.toLowerCase().trim()

    try {
      // Try sign in directly first
      res = await this.signIn(email)
    } catch (e) {
      if (e instanceof UserLambdaValidationException && e.message.includes('user not found')) {
        // Sign up and sign in
        await this.signUp(email)
        res = await this.signIn(email)
      } else {
        throw e
      }
    }

    if (!res.Session) {
      throw new Error('response session is empty')
    }

    return {
      // Notice: rename session to instance to avoid
      // confusion with the native waas session
      instance: res.Session,
      email: email
    }
  }

  public async finalizeAuth({
    instance,
    email,
    answer,
    sessionHash
  }: {
    instance: string
    email: string
    answer: string
    sessionHash: string
  }): Promise<IdTokenIdentity> {
    email = email.toLowerCase().trim()

    const res = await this.cognito().send(
      new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        Session: instance,
        ChallengeName: 'CUSTOM_CHALLENGE',
        ChallengeResponses: { USERNAME: email, ANSWER: answer },
        ClientMetadata: { SESSION_HASH: sessionHash }
      })
    )

    if (!res.AuthenticationResult || !res.AuthenticationResult.IdToken) {
      throw new Error('AuthenticationResult.IdToken is empty')
    }

    return { idToken: res.AuthenticationResult.IdToken }
  }
}

function getRandomString(len: number) {
  return Array.from(getRandomValues(len))
    .map(nr => nr.toString(16).padStart(2, '0'))
    .join('')
}

function getRandomValues(len: number) {
  const randomValues = new Uint8Array(len)
  if (typeof window === 'object' && typeof window.crypto === 'object') {
    return window.crypto.getRandomValues(randomValues)
  } else {
    console.warn('window.crypto.getRandomValues is not available. Falling back to less secure Math.random().')
    const randomValues = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      const randomInteger = Math.floor(Math.random() * 256)
      randomValues[i] = randomInteger
    }
    return randomValues
  }
}
