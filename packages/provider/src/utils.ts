import { ethers, BigNumberish, BytesLike } from 'ethers'
import { WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, DecodedSignature, isConfigEqual } from '@0xsequence/config'
import { packMessageData, encodeMessageDigest, TypedData, encodeTypedDataDigest } from '@0xsequence/utils'
import { Web3Provider } from './provider'
import { isValidSignature as _isValidSignature, recoverConfig, Signer } from '@0xsequence/wallet'

const eip191prefix = ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n')

export const messageToBytes = (message: BytesLike): Uint8Array => {
  if (ethers.utils.isBytes(message) || ethers.utils.isHexString(message)) {
    return ethers.utils.arrayify(message)
  }

  return ethers.utils.toUtf8Bytes(message)
}

export const prefixEIP191Message = (message: BytesLike): Uint8Array => {
  const messageBytes = messageToBytes(message)
  return ethers.utils.concat([eip191prefix, ethers.utils.toUtf8Bytes(String(messageBytes.length)), messageBytes])
}

export const isValidSignature = async (
  address: string,
  digest: Uint8Array,
  sig: string,
  provider: Web3Provider | ethers.providers.Web3Provider,
  chainId?: number,
  walletContext?: WalletContext
): Promise<boolean | undefined> => {
  if (!chainId) {
    chainId = (await provider.getNetwork())?.chainId
  }
  if (!walletContext && Web3Provider.isSequenceProvider(provider)) {
    walletContext = await provider.getSigner().getWalletContext()
  }
  return _isValidSignature(address, digest, sig, provider, walletContext, chainId)
}

export const isValidMessageSignature = async (
  address: string,
  message: string | Uint8Array,
  signature: string,
  provider: Web3Provider | ethers.providers.Web3Provider,
  chainId?: number,
  walletContext?: WalletContext
): Promise<boolean | undefined> => {
  const prefixed = prefixEIP191Message(message)
  const digest = encodeMessageDigest(prefixed)
  return isValidSignature(address, digest, signature, provider, chainId, walletContext)
}

export const isValidTypedDataSignature = (
  address: string,
  typedData: TypedData,
  signature: string,
  provider: Web3Provider | ethers.providers.Web3Provider,
  chainId?: number,
  walletContext?: WalletContext
): Promise<boolean | undefined> => {
  return isValidSignature(address, encodeTypedDataDigest(typedData), signature, provider, chainId, walletContext)
}

export const recoverWalletConfig = async (
  address: string,
  digest: BytesLike,
  signature: string | DecodedSignature,
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

export const isBrowserExtension = (): boolean =>
  window.location.protocol === 'chrome-extension:' || window.location.protocol === 'moz-extension:'


export interface ItemStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export class LocalStorage {
  private static _instance: ItemStore

  private constructor() {}

  static getInstance(): ItemStore {
    if (!LocalStorage._instance) {
      LocalStorage._instance = {
        getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
        setItem: (key: string, value: string) => Promise.resolve(window.localStorage.setItem(key, value)),
        removeItem: (key: string) => Promise.resolve(window.localStorage.removeItem(key))
      }
    }
    return this._instance
  }

  static use(instance: ItemStore) {
    LocalStorage._instance = instance
  }
}

// window.localstorage helper
export class LocalStore<T extends Object = string> {
  readonly key: string

  constructor(key: string, public def?: T) {
    this.key = key
  }

  async get(): Promise<T | undefined> {
    const val = await LocalStorage.getInstance().getItem(this.key)

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
    val ? LocalStorage.getInstance().setItem(this.key, JSON.stringify(val)) : LocalStorage.getInstance().removeItem(this.key)
  }

  del() {
    LocalStorage.getInstance().removeItem(this.key)
  }
}
