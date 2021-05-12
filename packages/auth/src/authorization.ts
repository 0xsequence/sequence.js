import { ethers } from 'ethers'
import { ETHAuth, Proof } from '@0xsequence/ethauth'
import { ETHAuthProof } from '@0xsequence/provider'
import { DEFAULT_SESSION_EXPIRATION } from './session'
import { Signer } from '@0xsequence/wallet'

export interface AuthorizationOptions {
  originHost?: string
  appName?: string
  expiration?: number
}

export const signAuthorization = async (signer: Signer, options?: AuthorizationOptions): Promise<ETHAuthProof> => {
  const chainId = await signer.getChainId()

  const address = ethers.utils.getAddress(await signer.getAddress())
  if (!address || address === '' || address === '0x') {
    throw EmptyAccountError
  }

  const expiry = options?.expiration ? Math.max(options.expiration, 200) : DEFAULT_SESSION_EXPIRATION

  const proof = new Proof()
  proof.address = address

  // TODO:
  // 1.) dont think window.location.origin is a good idea..... lets remove that..
  // 2.) app name 'unknown', seems wrong too.
  // .. we could make these both required..? .. or neither required..?
  proof.claims.ogn = options?.originHost || window.location.origin
  proof.claims.app = options?.appName || 'unknown'

  proof.setIssuedAtNow()
  proof.setExpiryIn(expiry)

  const typedData = proof.messageTypedData()

  proof.signature = await signer.signTypedData(typedData.domain, typedData.types, typedData.message, chainId)

  const ethAuth = new ETHAuth()

  const proofString = await ethAuth.encodeProof(proof, true)

  return {
    typedData,
    proofString
  }
}

export class AuthError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const EmptyAccountError = new AuthError('auth error: account address is empty')
