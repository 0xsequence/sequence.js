import { ethers } from 'ethers'
import { ETHAuth, Proof } from '@0xsequence/ethauth'
import { ChainIdLike, toChainIdNumber } from '@0xsequence/network'
import { TypedData } from '@0xsequence/utils'
import { Signer } from '@0xsequence/wallet'
import { Account } from '@0xsequence/account'
import { DEFAULT_SESSION_EXPIRATION } from './services'

export interface AuthorizationOptions {
  // app name string, ie 'Skyweaver'
  app?: string

  // origin hostname of encoded in the message, ie. 'play.skyweaver.net'
  origin?: string

  // expiry in seconds encoded in the message
  expiry?: number

  // nonce for the authorization request
  nonce?: number
}

export interface ETHAuthProof {
  // eip712 typed-data payload for ETHAuth domain as input
  typedData: TypedData

  // signature encoded in an ETHAuth proof string
  proofString: string
}

// signAuthorization will perform an EIP712 typed-data message signing of ETHAuth domain via the provided
// Signer and authorization options.
export const signAuthorization = async (
  signer: Signer | Account,
  chainId: ChainIdLike,
  options: AuthorizationOptions
): Promise<ETHAuthProof> => {
  const address = ethers.getAddress(await signer.getAddress())
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
  proof.claims.n = options.nonce

  proof.setExpiryIn(options.expiry ? Math.max(options.expiry, 200) : DEFAULT_SESSION_EXPIRATION)

  const typedData = proof.messageTypedData()

  const chainIdNumber = toChainIdNumber(chainId)

  proof.signature = await (signer instanceof Account
    ? // Account can sign EIP-6492 signatures, so it doesn't require deploying the wallet
      signer.signTypedData(typedData.domain, typedData.types, typedData.message, chainIdNumber, 'eip6492')
    : signer.signTypedData(typedData.domain, typedData.types, typedData.message, chainIdNumber))

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
