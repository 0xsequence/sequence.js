import { ethers, BigNumberish, BytesLike } from 'ethers'
import { TypedDataDomain, TypedDataField, TypedDataSigner } from '@ethersproject/abstract-signer'
import { WalletContext, ChainId } from '@0xsequence/network'
import { encodeMessageDigest, TypedData, encodeTypedDataDigest } from '@0xsequence/utils'
import { DecodedSignature } from '@0xsequence/wallet'
import { WalletConfig, addressOf } from '@0xsequence/config'
import { Wallet } from '../wallet'
import { isValidSignature, recoverWalletConfig } from '../utils'

export class WalletCommands {
  private wallet: Wallet

  constructor(walletProvider: Wallet) {
    this.wallet = walletProvider
  }

  // Sign message on a specified chain, or DefaultChain by default
  signMessage(message: BytesLike, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    const signer = this.wallet.getSigner()
    if (!signer) throw new Error('unable to get signer')
    return signer.signMessage(message, chainId, allSigners)
  }

  // Sign message on the AuthChain
  async signAuthMessage(message: BytesLike, allSigners?: boolean): Promise<string> {
    const signer = await this.wallet.getAuthSigner()
    if (!signer) throw new Error('unable to get AuthChain signer')
    return signer.signMessage(message, await signer.getChainId(), allSigners)
  }

  // Sign EIP-712 TypedData on a specified chain, or DefaultChain by default
  signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, chainId?: ChainId, allSigners?: boolean): Promise<string> {
    const signer = this.wallet.getSigner()
    if (!signer) throw new Error('unable to get signer')
    return signer.signTypedData(domain, types, value, chainId, allSigners)
  }

  // Sign EIP-712 TypedData on the AuthChain
  async signAuthTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, allSigners?: boolean): Promise<string> {
    const signer = await this.wallet.getAuthSigner()
    if (!signer) throw new Error('unable to get AuthChain signer')
    return signer.signTypedData(domain, types, value, await signer.getChainId(), allSigners)
  }

  // Verify signature of a digest, one of a message, typedData or other
  async isValidSignature(
    address: string,
    digest: Uint8Array,
    signature: string,
    chainId?: number,
    walletContext?: WalletContext
  ): Promise<boolean> {
    const provider = this.wallet.getProvider(chainId)
    return isValidSignature(address, digest, signature, provider, chainId, walletContext)
  }

  // Verify message signature
  isValidMessageSignature(
    address: string,
    message: string | Uint8Array,
    signature: string,
    chainId?: number,
    walletContext?: WalletContext
  ): Promise<boolean> {
    return this.isValidSignature(address, encodeMessageDigest(message), signature, chainId, walletContext)
  }

  // Verify typedData signature
  isValidTypedDataSignature(
    address: string,
    typedData: TypedData,
    signature: string,
    chainId?: number,
    walletContext?: WalletContext
  ): Promise<boolean> {
    return this.isValidSignature(address, encodeTypedDataDigest(typedData), signature, chainId, walletContext)
  }

  // Recover the WalletConfig from a signature + digest combo
  recoverWalletConfig = async (
    address: string,
    digest: BytesLike,
    signature: string | DecodedSignature,
    chainId: BigNumberish,
    walletContext?: WalletContext
  ): Promise<WalletConfig> => {
    walletContext ||= await this.wallet.getWalletContext()
    return recoverWalletConfig(address, digest, signature, chainId, walletContext)
  }

  // Recover the WalletConfig from a signature of a message
  recoverWalletConfigFromMessage = async (
    address: string,
    message: string | Uint8Array,
    signature: string | DecodedSignature,
    chainId: BigNumberish,
    walletContext?: WalletContext
  ): Promise<WalletConfig> => {
    walletContext ||= await this.wallet.getWalletContext()
    return recoverWalletConfig(address, encodeMessageDigest(message), signature, chainId, walletContext)
  }

  // Recover the WalletConfig from a signature of a typedData object
  recoverWalletConfigFromTypedData = async (
    address: string,
    typedData: TypedData,
    signature: string | DecodedSignature,
    chainId: BigNumberish,
    walletContext?: WalletContext
  ): Promise<WalletConfig> => {
    walletContext ||= await this.wallet.getWalletContext()
    return recoverWalletConfig(address, encodeTypedDataDigest(typedData), signature, chainId, walletContext)
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

  // isWalletDeployed()
  // deployWallet()

  // validateSignature()
  // recoverWalletConfig()
  // recoverAddress()
}
