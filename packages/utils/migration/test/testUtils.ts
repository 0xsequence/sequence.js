import { Wallet as V1Wallet } from '@0xsequence/v2wallet'
import { v1 } from '@0xsequence/v2core'
import { Hex, Address } from 'ox'
import { ethers } from 'ethers'
import { Signers as V3Signers } from '@0xsequence/wallet-core'
import { Secp256k1 } from 'ox'

export type MultiSigner = {
  pk: Hex.Hex
  address: Address.Address
  v2: ethers.Signer
  v3: V3Signers.Pk.Pk
}

export type V1WalletType = V1Wallet<v1.config.WalletConfig, v1.signature.Signature, v1.signature.UnrecoveredSignature>

export const createMultiSigner = (pk: Hex.Hex, provider: ethers.Provider): MultiSigner => {
  const v2Signer = new ethers.Wallet(pk, provider)
  // Override the v2.getAddress() to return the address lower cased for v1 Orchestrator compatibility
  const v2: any = v2Signer
  v2.getAddress = async () => {
    return v2Signer.address.toLowerCase()
  }
  return {
    pk,
    address: Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pk })),
    v2,
    v3: new V3Signers.Pk.Pk(pk),
  }
}
