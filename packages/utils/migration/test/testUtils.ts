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
  return {
    pk,
    address: Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pk })),
    v2: new ethers.Wallet(pk, provider),
    v3: new V3Signers.Pk.Pk(pk),
  }
}
