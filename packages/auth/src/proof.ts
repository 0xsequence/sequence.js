import { commons } from "@0xsequence/core"
import { Proof, ValidatorFunc } from "@0xsequence/ethauth"
import { tracker } from "@0xsequence/sessions"
import { ethers } from "ethers"

export const ValidateSequenceWalletProof = (
  reader: commons.reader.Reader,
  tracker: tracker.ConfigTracker,
  context: commons.context.WalletContext,
  coders: {
    signature: commons.signature.SignatureCoder,
    config: commons.config.ConfigCoder,
  }
): ValidatorFunc => {
  return async (
    provider: ethers.providers.JsonRpcProvider,
    _chainId: number,
    proof: Proof
  ): Promise<{ isValid: boolean }> => {
    const digest = proof.messageDigest()
    const isDeployed = await reader.isDeployed(proof.address)

    if (isDeployed) {
      // Easy, we just call the contract to validate the signature
      const isValid = await reader.isValidSignature(proof.address, digest, proof.signature)
      return { isValid }
    }

    // We need to fully recover the signature, compute the config
    // then the imageHash, and finally check if the imageHash matches
    // the counterfactual address.

    // NOTICE: We should replace this by an EIP used to validate undeployed wallet's signatures

    const decoded = coders.signature.decode(proof.signature)
    const recovered = await coders.signature.recover(decoded, {
      address: proof.address,
      digest: ethers.utils.hexlify(digest),
      chainid: 0 // Sequence uses chainId 0 for all networks, proofs are not chain specific
    }, provider)

    const imageHash = coders.config.imageHashOf(recovered.config)
    const counterfactualAddress = commons.context.addressOf(context, imageHash)

    return {
      isValid: counterfactualAddress.toLowerCase() === proof.address.toLowerCase()
    }
  }
}
