import { BigNumberish, BytesLike } from 'ethers'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, DecodedSignature } from '@0xsequence/config'
import { packMessageData } from '@0xsequence/utils'
import { Web3Provider } from './provider'
import { isValidSignature as _isValidSignature, recoverConfig } from '@0xsequence/wallet'

export const isValidSignature = async (
  address: string,
  digest: Uint8Array,
  sig: string,
  provider: Web3Provider,
  chainId?: number,
  walletContext?: WalletContext
): Promise<boolean | undefined> => {
  chainId = chainId || await provider.getChainId()
  walletContext = walletContext || await provider.getSigner().getWalletContext()
  return _isValidSignature(address, digest, sig, provider, walletContext, chainId)
}

export const recoverWalletConfig = async (
  address: string,
  digest: BytesLike,
  signature: string | DecodedSignature,
  chainId: BigNumberish,
  walletContext?: WalletContext
): Promise<WalletConfig> => {
  const subDigest = packMessageData(address, chainId, digest)
  const config = await recoverConfig(subDigest, signature)

  if (walletContext) {
    const recoveredWalletAddress = addressOf(config, walletContext)
    if (config.address && config.address !== recoveredWalletAddress) {
      throw new Error('recovered address does not match the WalletConfig address, check the WalletContext')
    } else {
      config.address = recoveredWalletAddress
    }
  }

  return config
}

export const isChromeExtension = (): boolean => window.location.protocol === 'chrome-extension:'

// window.localstorage helper
export class LocalStore<T extends Object = string> {
  readonly key: string

  constructor(key: string, public def?: T) {
    this.key = key
  }

  get(): T | undefined {
    const val = window.localStorage.getItem(this.key)

    if (val === null) {
      return this.def
    }

    try {
      return JSON.parse(val)
    } catch (err) {
      console.error(err)
    }

    return
  }

  set(val: T | undefined) {
    val ? window.localStorage.setItem(this.key, JSON.stringify(val)) : window.localStorage.removeItem(this.key)
  }

  del() {
    window.localStorage.removeItem(this.key)
  }
}
