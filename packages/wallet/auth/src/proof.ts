import { commons } from '@0xsequence/core'
import { Proof, ValidatorFunc } from '@0xsequence/ethauth'
import { tracker } from '@0xsequence/sessions'
import { ethers } from 'ethers'

export const ValidateSequenceWalletProof = (
  readerFor: (chainId: number) => commons.reader.Reader,
  tracker: tracker.ConfigTracker,
  context: commons.context.WalletContext
): ValidatorFunc => {
  return async (_provider: ethers.JsonRpcProvider, chainId: number, proof: Proof): Promise<{ isValid: boolean }> => {
    const digest = proof.messageDigest()
    const isValid = await readerFor(chainId).isValidSignature(proof.address, digest, proof.signature)
    return { isValid }
  }
}
