import { Payload, Signature } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { Reader } from '.'
import { isSapientSigner, SapientSigner, Signer } from '../signers'

export type WalletWithWitness<S extends Signer | SapientSigner> = {
  wallet: Address.Address
  chainId: bigint
  payload: Payload.Parented
  signature: S extends SapientSigner ? Signature.SignatureOfSapientSignerLeaf : Signature.SignatureOfSignerLeaf
}

export async function getWalletsFor<S extends Signer | SapientSigner>(
  stateReader: Reader,
  signer: S,
): Promise<Array<WalletWithWitness<S>>> {
  const wallets = await retrieveWallets(stateReader, signer)
  return Object.entries(wallets).map(([wallet, { chainId, payload, signature }]) => {
    Hex.assert(wallet)
    return {
      wallet,
      chainId,
      payload,
      signature,
    }
  })
}

async function retrieveWallets<S extends Signer | SapientSigner>(
  stateReader: Reader,
  signer: S,
): Promise<{
  [wallet: `0x${string}`]: {
    chainId: bigint
    payload: Payload.Parented
    signature: S extends SapientSigner ? Signature.SignatureOfSapientSignerLeaf : Signature.SignatureOfSignerLeaf
  }
}> {
  if (isSapientSigner(signer)) {
    const [signerAddress, signerImageHash] = await Promise.all([signer.address, signer.imageHash])
    if (signerImageHash) {
      return stateReader.getWalletsForSapient(signerAddress, signerImageHash) as unknown as any
    } else {
      console.warn('Sapient signer has no imageHash')
      return {} as any
    }
  } else {
    return stateReader.getWallets(await signer.address) as unknown as any
  }
}
