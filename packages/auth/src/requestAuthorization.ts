import { ethers } from 'ethers'
import { ETHAuth, Proof } from '@0xsequence/ethauth'
import { ETHAuthProof } from '@0xsequence/provider'
import { DEFAULT_SESSION_EXPIRATION } from './session'
import { Account } from '@0xsequence/wallet'

export interface AuthorizationOptions {
  originHost?: string
  appName?: string
  expiration?: number
}

export const requestAuthorization = async (wallet: Account, options?: AuthorizationOptions): Promise<ETHAuthProof> => {
  const chainId = await wallet.getChainId()

  const address = ethers.utils.getAddress(await wallet.getAddress())
  if (!address || address === '' || address === '0x') {
    throw EmptyAccountError
  }

  const expiry = options?.expiration ? Math.max(options.expiration, 120) : DEFAULT_SESSION_EXPIRATION

  const proof = new Proof()
  proof.address = address
  proof.claims.ogn = options?.originHost || window.location.origin
  proof.claims.app = options?.appName || 'unknown'
  proof.setIssuedAtNow()
  proof.setExpiryIn(expiry)

  const typedData = proof.messageTypedData()

  proof.signature = await wallet.signTypedData(typedData.domain, typedData.types, typedData.message, chainId)

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
