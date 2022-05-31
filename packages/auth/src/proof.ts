import { ethers } from 'ethers'
import { Proof, ValidatorFunc } from '@0xsequence/ethauth'
import { WalletContext } from '@0xsequence/network'
import { isValidSignature } from '@0xsequence/wallet'
import { ConfigTracker } from '@0xsequence/config'

export function NewSequenceProofValidator(context: WalletContext, configTracker: ConfigTracker): ValidatorFunc {
  return async (provider: ethers.providers.JsonRpcProvider, chainId: number, proof: Proof): Promise<{ isValid: boolean, address?: string }> => {
    // Compute eip712 message digest from the proof claims
    const digest = proof.messageDigest()

    const isValid = await isValidSignature({
      address: proof.address,
      digest,
      signature: proof.signature,
      provider,
      context,
      chainId,
      configTracker
    })
  
    return { isValid }
  }
}
