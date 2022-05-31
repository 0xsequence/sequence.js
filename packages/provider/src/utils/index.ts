import { BigNumberish, BytesLike } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { WalletContext, ChainIdLike } from '@0xsequence/network'
import { encodeMessageDigest, TypedData, encodeTypedDataDigest } from '@0xsequence/utils'
import { ConfigTracker, DecodedSignature, WalletConfig } from '@0xsequence/config'
import { Wallet } from '../wallet'
import { recoverWalletConfig } from '../utils'
import { isValidSignature, prefixEIP191Message } from '@0xsequence/wallet'

export class WalletUtils {
  private wallet: Wallet

  private configTracker: ConfigTracker

  constructor(walletProvider: Wallet) {
    this.wallet = walletProvider
  }

  async _configTracker() {
    if (this.configTracker) return this.configTracker
    const res = await this.wallet.getConfigTracker()
    if (res) this.configTracker = res
    return res
  }

  // Sign message on a specified chain, or DefaultChain by default
  signMessage(message: BytesLike, chainId?: ChainIdLike, allSigners?: boolean): Promise<string> {
    const signer = this.wallet.getSigner()
    if (!signer) throw new Error('unable to get signer')
    return signer.signMessage(message, chainId, allSigners)
  }

  // Sign EIP-712 TypedData on a specified chain, or DefaultChain by default
  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<string> {
    const signer = this.wallet.getSigner()
    if (!signer) throw new Error('unable to get signer')
    return signer.signTypedData(domain, types, message, chainId, allSigners)
  }

  // Verify signature of a digest, one of a message, typedData or other
  async isValidSignature(
    address: string,
    digest: Uint8Array,
    signature: string,
    chainId: number,
    walletContext?: WalletContext
  ): Promise<boolean | undefined> {
    const provider = this.wallet.getProvider(chainId)
    if (!provider) throw new Error(`unable to get provider for chainId ${chainId}`)

    const configTracker = await this._configTracker()

    // return isValidSignature(address, digest, signature, provider, chainId, walletContext, configTracker)
    return isValidSignature({
      address,
      digest,
      signature,
      chainId,
      context: walletContext,
      provider,
      configTracker
    })
  }

  // Verify message signature
  async isValidMessageSignature(
    address: string,
    message: string | Uint8Array,
    signature: string,
    chainId: number,
    walletContext?: WalletContext,
  ): Promise<boolean | undefined> {
    const provider = this.wallet.getProvider(chainId)
    if (!provider) throw new Error(`unable to get provider for chainId ${chainId}`)

    const configTracker = await this._configTracker()

    const prefixed = prefixEIP191Message(message)
    const digest = encodeMessageDigest(prefixed)
    return isValidSignature({
      address,
      digest,
      signature,
      chainId,
      context: walletContext,
      provider,
      configTracker
    })
  }

  // Verify typedData signature
  isValidTypedDataSignature(
    address: string,
    typedData: TypedData,
    signature: string,
    chainId: number,
    walletContext?: WalletContext
  ): Promise<boolean | undefined> {
    return this.isValidSignature(address, encodeTypedDataDigest(typedData), signature, chainId, walletContext)
  }

  // Recover the WalletConfig from a signature + digest combo
  recoverWalletConfig = async (
    address: string,
    digest: BytesLike,
    signature: string | DecodedSignature,
    chainId: BigNumberish,
    walletContext?: WalletContext
  ): Promise<WalletConfig> => {
    walletContext = walletContext || (await this.wallet.getWalletContext())

    const provider = this.wallet.getProvider(chainId)
    if (!provider) throw new Error(`unable to get provider for chainId ${chainId}`)

    const configTracker = await this._configTracker()

    return recoverWalletConfig(address, digest, signature, chainId, provider, configTracker, walletContext)
  }

  // Recover the WalletConfig from a signature of a message
  recoverWalletConfigFromMessage = async (
    address: string,
    message: string | Uint8Array,
    signature: string | DecodedSignature,
    chainId: BigNumberish,
    walletContext?: WalletContext
  ): Promise<WalletConfig> => {
    walletContext = walletContext || (await this.wallet.getWalletContext())

    const provider = this.wallet.getProvider(chainId)
    if (!provider) throw new Error(`unable to get provider for chainId ${chainId}`)

    const configTracker = await this._configTracker()

    return recoverWalletConfig(address, encodeMessageDigest(prefixEIP191Message(message)), signature, chainId, provider, configTracker, walletContext)
  }

  // Recover the WalletConfig from a signature of a typedData object
  recoverWalletConfigFromTypedData = async (
    address: string,
    typedData: TypedData,
    signature: string | DecodedSignature,
    chainId: BigNumberish,
    walletContext?: WalletContext
  ): Promise<WalletConfig> => {
    walletContext = walletContext || (await this.wallet.getWalletContext())

    const provider = this.wallet.getProvider(chainId)
    if (!provider) throw new Error(`unable to get provider for chainId ${chainId}`)

    const configTracker = await this._configTracker()

    return recoverWalletConfig(address, encodeTypedDataDigest(typedData), signature, chainId, provider, configTracker, walletContext)
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
