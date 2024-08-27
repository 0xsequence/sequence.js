import { ethers } from 'ethers'
import { ChainIdLike } from '@0xsequence/network'
import { encodeMessageDigest, TypedData, encodeTypedDataDigest } from '@0xsequence/utils'
import { isValidSignature, prefixEIP191Message } from '../utils'
import { SequenceSigner, SingleNetworkSequenceSigner } from '../signer'

/**
 *  This class is redundant with the SequenceSigner class, but it is here for now to
 *  maintain compatibility with the old wallet API. Eventually we should move these
 *  methods to the SequenceSigner class and deprecate this class.
 */
export class WalletUtils {
  constructor(public signer: SequenceSigner) {
    if (SingleNetworkSequenceSigner.is(signer)) {
      throw new Error('WalletUtils does not support SingleNetworkSequenceSigner')
    }
  }

  // Sign message on a specified chain, or DefaultChain by default
  signMessage(message: ethers.BytesLike, chainId?: ChainIdLike, eip6492?: boolean): Promise<string> {
    return this.signer.signMessage(message, { chainId, eip6492 })
  }

  // Sign EIP-712 TypedData on a specified chain, or DefaultChain by default
  signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, Array<ethers.TypedDataField>>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    eip6492?: boolean
  ): Promise<string> {
    return this.signer.signTypedData(domain, types, message, { chainId, eip6492 })
  }

  // Verify signature of a digest, one of a message, typedData or other
  async isValidSignature(address: string, digest: Uint8Array, signature: string, chainId: number): Promise<boolean> {
    return isValidSignature(address, digest, signature, this.signer.getProvider(chainId))
  }

  // Verify message signature
  async isValidMessageSignature(
    address: string,
    message: string | Uint8Array,
    signature: string,
    chainId: number
  ): Promise<boolean> {
    const provider = this.signer.getProvider(chainId)
    const prefixed = prefixEIP191Message(message)
    const digest = encodeMessageDigest(prefixed)
    return isValidSignature(address, digest, signature, provider)
  }

  // Verify typedData signature
  isValidTypedDataSignature(address: string, typedData: TypedData, signature: string, chainId: number): Promise<boolean> {
    return this.isValidSignature(address, encodeTypedDataDigest(typedData), signature, chainId)
  }

  // sendTransaction()
  // sendTransactions()

  // sendETH()
  // sendToken()
  // sendCoin() -- sugar for sendToken()
  // sendCollectible() -- sugar for sendToken()
  // callContract()

  // transactionHistory()
  // getReceipt()
  // getLogs()
  // // ..

  // validateSignature()
  // recoverWalletConfig()
  // recoverAddress()
}
