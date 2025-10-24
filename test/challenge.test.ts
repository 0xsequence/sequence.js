import { describe, expect, it } from 'vitest'
import { AuthCodeChallenge, AuthCodePkceChallenge, IdTokenChallenge, OtpChallenge } from '../src/challenge.js'
import { IdentityType, KeyType } from '../src/index.js'

describe('IdTokenChallenge', () => {
  const idToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaXNzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsImF1ZCI6ImF1ZGllbmNlIiwiaWF0IjoxNzE2MjM5MDIyLCJleHAiOjE4MTYyMzkwMjJ9.vo-hzFNUd8uzKmMVEj04eIiqeXfOQahZu9ZWGnJPE74'

  it('returns correct commit params', () => {
    const challenge = new IdTokenChallenge('https://example.com', 'audience', idToken)
    const params = challenge.getCommitParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('IDToken')
    expect(params.identityType).toBe('OIDC')
    expect(params.handle).toBe('0x800fa2a1ca87f4a37d7f0a2e1858d36cd622cc2970d886e7e8a00f82edca3455')
    expect(params.metadata).toBeDefined()
    expect(params.metadata.iss).toBe('https://example.com')
    expect(params.metadata.aud).toBe('audience')
    expect(params.metadata.exp).toBe('1816239022')
  })

  it('returns correct complete params', () => {
    const challenge = new IdTokenChallenge('https://example.com', 'audience', idToken)
    const params = challenge.getCompleteParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('IDToken')
    expect(params.identityType).toBe('OIDC')
    expect(params.verifier).toBe('0x800fa2a1ca87f4a37d7f0a2e1858d36cd622cc2970d886e7e8a00f82edca3455')
    expect(params.answer).toBe(idToken)
  })
})

describe('AuthCodeChallenge', () => {
  const authCode = '1234567890'
  const signer = { address: '0x26F5B2b3Feed8f02051c0b1c5b40cc088107935e', keyType: KeyType.Ethereum_Secp256k1 }

  it('returns correct commit params', () => {
    const challenge = new AuthCodeChallenge('https://example.com', 'audience', 'https://dapp.com/redirect', authCode)
    const params = challenge.getCommitParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('AuthCode')
    expect(params.identityType).toBe('OIDC')
    expect(params.handle).toBe('0x38301fb0b5fcf3aaa4b97c4771bb6c75546e313b4ce7057c51a8cc6a3ace9d7e')
    expect(params.signer).toBeUndefined()
    expect(params.metadata).toBeDefined()
    expect(params.metadata.iss).toBe('https://example.com')
    expect(params.metadata.aud).toBe('audience')
    expect(params.metadata.redirect_uri).toBe('https://dapp.com/redirect')
  })

  it('returns correct commit params with signer', () => {
    const challenge = new AuthCodeChallenge('https://example.com', 'audience', 'https://dapp.com/redirect', authCode)
    const params = challenge.withSigner(signer).getCommitParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('AuthCode')
    expect(params.identityType).toBe('OIDC')
    expect(params.signer).toBe(signer)
    expect(params.handle).toBe('0x38301fb0b5fcf3aaa4b97c4771bb6c75546e313b4ce7057c51a8cc6a3ace9d7e')
    expect(params.metadata).toBeDefined()
    expect(params.metadata.iss).toBe('https://example.com')
    expect(params.metadata.aud).toBe('audience')
    expect(params.metadata.redirect_uri).toBe('https://dapp.com/redirect')
  })

  it('returns correct complete params', () => {
    const challenge = new AuthCodeChallenge('https://example.com', 'audience', 'https://dapp.com/redirect', authCode)
    const params = challenge.getCompleteParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('AuthCode')
    expect(params.identityType).toBe('OIDC')
    expect(params.verifier).toBe('0x38301fb0b5fcf3aaa4b97c4771bb6c75546e313b4ce7057c51a8cc6a3ace9d7e')
    expect(params.answer).toBe(authCode)
  })
})

describe('AuthCodePkceChallenge', () => {
  const challenge = new AuthCodePkceChallenge('https://example.com', 'audience', 'https://dapp.com/redirect')
  const authCode = '1234567890'
  const verifier = 'verifier'
  const signer = { address: '0x26F5B2b3Feed8f02051c0b1c5b40cc088107935e', keyType: KeyType.Ethereum_Secp256k1 }

  it('returns correct commit params', () => {
    const params = challenge.getCommitParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('AuthCodePKCE')
    expect(params.identityType).toBe('OIDC')
    expect(params.handle).toBeUndefined()
    expect(params.metadata).toBeDefined()
    expect(params.metadata.iss).toBe('https://example.com')
    expect(params.metadata.aud).toBe('audience')
    expect(params.metadata.redirect_uri).toBe('https://dapp.com/redirect')
  })

  it('returns correct commit params with signer', () => {
    const params = challenge.withSigner(signer).getCommitParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('AuthCodePKCE')
    expect(params.identityType).toBe('OIDC')
    expect(params.signer).toBe(signer)
    expect(params.handle).toBeUndefined()
    expect(params.metadata).toBeDefined()
    expect(params.metadata.iss).toBe('https://example.com')
    expect(params.metadata.aud).toBe('audience')
    expect(params.metadata.redirect_uri).toBe('https://dapp.com/redirect')
  })

  it('returns correct complete params with answer and verifier', () => {
    const params = challenge.withAnswer(verifier, authCode).getCompleteParams()
    expect(params).toBeDefined()
    expect(params.authMode).toBe('AuthCodePKCE')
    expect(params.identityType).toBe('OIDC')
    expect(params.verifier).toBe(verifier)
    expect(params.answer).toBe(authCode)
  })

  it('throws if answer and verifier are not provided', () => {
    expect(() => challenge.getCompleteParams()).toThrow()
  })

  it('throws if answer is not provided', () => {
    expect(() => challenge.withAnswer(verifier, '').getCompleteParams()).toThrow()
  })

  it('throws if verifier is not provided', () => {
    expect(() => challenge.withAnswer('', authCode).getCompleteParams()).toThrow()
  })
})

describe('OtpChallenge', () => {
  const otp = '123456'
  const codeChallenge = 'codeChallenge'

  // finalAnswer = keccak256(codeChallenge + otp)
  const finalAnswer = '0xab1b443dd7ae1f1dd51f81f8d346565c1a63e7d090a1c220e44ed578183b08f5'

  describe('fromRecipient', () => {
    const recipient = 'test@example.com'

    describe('getCommitParams', () => {
      it('returns correct commit params', () => {
        const challenge = OtpChallenge.fromRecipient(IdentityType.Email, recipient)
        const params = challenge.getCommitParams()
        expect(params).toBeDefined()
        expect(params.authMode).toBe('OTP')
        expect(params.identityType).toBe('Email')
        expect(params.handle).toBe(recipient)
        expect(params.signer).toBeUndefined()
      })

      it('throws if recipient is not provided', () => {
        const challenge = OtpChallenge.fromRecipient(IdentityType.Email, '')
        expect(() => challenge.getCommitParams()).toThrow()
      })
    })

    describe('getCompleteParams', () => {
      it('returns correct complete params', () => {
        const challenge = OtpChallenge.fromRecipient(IdentityType.Email, recipient)
        const params = challenge.withAnswer(codeChallenge, otp).getCompleteParams()
        expect(params).toBeDefined()
        expect(params.authMode).toBe('OTP')
        expect(params.identityType).toBe('Email')
        expect(params.verifier).toBe(recipient)
        expect(params.answer).toBe(finalAnswer)
      })

      it('throws if answer is not provided', () => {
        const challenge = OtpChallenge.fromRecipient(IdentityType.Email, recipient)
        expect(() => challenge.getCompleteParams()).toThrow()
      })
    })
  })

  describe('fromSigner', () => {
    const signer = { address: '0x26F5B2b3Feed8f02051c0b1c5b40cc088107935e', keyType: KeyType.Ethereum_Secp256k1 }

    describe('getCommitParams', () => {
      it('returns correct commit params', () => {
        const challenge = OtpChallenge.fromSigner(IdentityType.Email, signer)
        const params = challenge.getCommitParams()
        expect(params).toBeDefined()
        expect(params.authMode).toBe('OTP')
        expect(params.identityType).toBe('Email')
        expect(params.handle).toBeUndefined()
        expect(params.signer).toBe(signer)
      })

      it('throws if signer is not provided', () => {
        const challenge = OtpChallenge.fromSigner(IdentityType.Email, {
          address: '',
          keyType: KeyType.Ethereum_Secp256k1,
        })
        expect(() => challenge.getCommitParams()).toThrow()
      })
    })
  })
})
