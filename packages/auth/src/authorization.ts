import { ethers } from 'ethers'
import { ETHAuth, Proof } from '@0xsequence/ethauth'
import { ETHAuthProof } from '@0xsequence/provider'
import { DEFAULT_SESSION_EXPIRATION } from './session'
import { Signer } from '@0xsequence/wallet'

export interface AuthorizationOptions {
  // app name string, ie 'Skyweaver'
  app?: string

  // origin hostname of encoded in the message, ie. 'play.skyweaver.net'
  origin?: string

  // expiry in seconds encoded in the message
  expiry?: number
}

// signAuthorization will perform an EIP712 typed-data message signing of ETHAuth domain via the provided
// Signer and authorization options.
export const signAuthorization = async (signer: Signer, options: AuthorizationOptions): Promise<ETHAuthProof> => {
  const chainId = await signer.getChainId()

  const address = ethers.utils.getAddress(await signer.getAddress())
  if (!address || address === '' || address === '0x') {
    throw ErrAccountIsRequired
  }

  const proof = new Proof()
  proof.address = address

  if (!options || !options.app || options.app === '') {
    throw new AuthError('authorization options requires app to be set')
  }
  proof.claims.app = options.app
  proof.claims.ogn = options.origin

  proof.setExpiryIn(options.expiry ? Math.max(options.expiry, 200) : DEFAULT_SESSION_EXPIRATION)

  const typedData = proof.messageTypedData()
  proof.signature = await signer.signTypedData(typedData.domain, typedData.types, typedData.message, chainId)

  const ethAuth = new ETHAuth()
  const proofString = await ethAuth.encodeProof(proof, true)

  return {
    typedData,
    proofString
  }
}

// TODO: review......
export class AuthError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const ErrAccountIsRequired = new AuthError('auth error: account address is empty')
