import { ethers, BytesLike } from 'ethers'
import { Web3Provider } from './provider'
import { messageIsExemptFromEIP191Prefix } from './eip191exceptions'
import { OnChainReader } from '@0xsequence/core/src/commons/reader'
import { AccountStatus } from '@0xsequence/account'

const eip191prefix = ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n')

export const messageToBytes = (message: BytesLike): Uint8Array => {
  if (ethers.utils.isBytes(message) || ethers.utils.isHexString(message)) {
    return ethers.utils.arrayify(message)
  }

  return ethers.utils.toUtf8Bytes(message)
}

export const prefixEIP191Message = (message: BytesLike): Uint8Array => {
  const messageBytes = messageToBytes(message)
  if (messageIsExemptFromEIP191Prefix(messageBytes)) {
    return messageBytes
  } else {
    return ethers.utils.concat([eip191prefix, ethers.utils.toUtf8Bytes(String(messageBytes.length)), messageBytes])
  }
}

export const isValidSignature = async (
  address: string,
  digest: Uint8Array,
  sig: string,
  provider: Web3Provider | ethers.providers.Web3Provider
): Promise<boolean> => {
  const reader = new OnChainReader(provider)
  return reader.isValidSignature(address, digest, sig)
}

// export const isValidMessageSignature = async (
//   address: string,
//   message: string | Uint8Array,
//   signature: string,
//   provider: Web3Provider | ethers.providers.Web3Provider,
//   chainId?: number,
//   walletContext?: WalletContext
// ): Promise<boolean> => {
//   const prefixed = prefixEIP191Message(message)
//   const digest = encodeMessageDigest(prefixed)
//   return isValidSignature(address, digest, signature, provider, chainId, walletContext)
// }

// export const isValidTypedDataSignature = (
//   address: string,
//   typedData: TypedData,
//   signature: string,
//   provider: Web3Provider | ethers.providers.Web3Provider,
//   chainId?: number,
//   walletContext?: WalletContext
// ): Promise<boolean> => {
//   return isValidSignature(address, encodeTypedDataDigest(typedData), signature, provider, chainId, walletContext)
// }

// export const recoverWalletConfig = async (
//   address: string,
//   digest: BytesLike,
//   signature: string | commons.signature.UnrecoveredSignature | commons.signature.Signature<commons.config.Config>,
//   chainId: BigNumberish,
//   walletContext?: WalletContext
// ): Promise<commons.config.Config> => {
//   const subDigest = packMessageData(address, chainId, digest)
//   const config = await recoverConfig(subDigest, signature)

//   if (walletContext) {
//     const recoveredWalletAddress = addressOf(config, walletContext)
//     if (config.address && config.address !== recoveredWalletAddress) {
//       throw new Error('recovered address does not match the WalletConfig address, check the WalletContext')
//     } else {
//       config.address = recoveredWalletAddress
//     }
//   }

//   return config
// }

export const isBrowserExtension = (): boolean =>
  window.location.protocol === 'chrome-extension:' || window.location.protocol === 'moz-extension:'

export const isUnityPlugin = (): boolean => !!navigator.userAgent.match(/UnitySequence/i)

// /**
//  * Returns the status of a signer's wallet on given chain by checking wallet deployment and config status
//  *
//  * @param {Status} of the wallet
//  */
export const isWalletUpToDate = (status: AccountStatus): boolean => {
  return (
    status.onChain.deployed &&
    status.fullyMigrated
  )
}

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
