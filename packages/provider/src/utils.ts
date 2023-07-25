import { ethers, BytesLike } from 'ethers'
import { messageIsExemptFromEIP191Prefix } from './eip191exceptions'
import { AccountStatus } from '@0xsequence/account'
import { commons } from '@0xsequence/core'
import { encodeMessageDigest, TypedData, encodeTypedDataDigest } from '@0xsequence/utils'

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

export const trimEIP191Prefix = (prefixedMessage: Uint8Array): Uint8Array => {
  // If the message is not prefixed, we return the message as is.
  if (JSON.stringify(prefixedMessage.slice(0, eip191prefix.length)) !== JSON.stringify(eip191prefix)) {
    return prefixedMessage
  }

  // We have two parts to remove.
  // First is the EIP-191 prefix.
  const ethereumSignedMessagePartSlicedArray = prefixedMessage.slice(eip191prefix.length)

  // Second is the digits added which represent length of the message without the prefix
  // and we need to find the prefix that will match this.
  // Here first we take the max prefix char length, and check if as a number it is bigger
  // than the length of the message (since prefix is added to represent length of original message),
  // if it is we remove 1 from char length, if not we keep the max prefix char length.
  // As an example for the case where , if the message is 123456789, the expected prefix char is 9, with starting value 9123456789
  // the char length of the total message with the prefix is 10, so the max prefix char length we start is 2 from [1,0], and as a number 10, it is longer
  // than the length of the message after removing prefix (10 - 2 = 8), so we slice 1 char less, which is 9, and we get the correct prefix.
  const maxPrefixCharLength = String(ethereumSignedMessagePartSlicedArray.length).length

  let prefixCharLenght: number
  let prefixAsNumber: number

  try {
    prefixAsNumber = Number(ethers.utils.toUtf8String(ethereumSignedMessagePartSlicedArray.slice(0, maxPrefixCharLength)))
  } catch {
    prefixAsNumber = Number(ethers.utils.hexlify(ethereumSignedMessagePartSlicedArray.slice(0, maxPrefixCharLength)))
  }

  if (prefixAsNumber > ethereumSignedMessagePartSlicedArray.length || !Number.isInteger(prefixAsNumber)) {
    prefixCharLenght = maxPrefixCharLength - 1
  } else {
    prefixCharLenght = maxPrefixCharLength
  }

  const prefixRevertedMessage = ethereumSignedMessagePartSlicedArray.slice(prefixCharLenght)

  return prefixRevertedMessage
}

export const isValidSignature = async (
  address: string,
  digest: Uint8Array,
  sig: string,
  provider: ethers.providers.Provider
): Promise<boolean> => {
  const reader = new commons.reader.OnChainReader(provider)
  return reader.isValidSignature(address, digest, sig)
}

// Verify message signature
export const isValidMessageSignature = async (
  address: string,
  message: string | Uint8Array,
  signature: string,
  provider: ethers.providers.Provider
): Promise<boolean> => {
  const prefixed = prefixEIP191Message(message)
  const digest = encodeMessageDigest(prefixed)
  return isValidSignature(address, digest, signature, provider)
}

// Verify typedData signature
export const isValidTypedDataSignature = (
  address: string,
  typedData: TypedData,
  signature: string,
  provider: ethers.providers.Provider
): Promise<boolean> => {
  return isValidSignature(address, encodeTypedDataDigest(typedData), signature, provider)
}


export const isBrowserExtension = (): boolean =>
  window.location.protocol === 'chrome-extension:' || window.location.protocol === 'moz-extension:'

export const isUnityPlugin = (): boolean => !!navigator.userAgent.match(/UnitySequence/i)

// /**
//  * Returns the status of a signer's wallet on given chain by checking wallet deployment and config status
//  *
//  * @param {Status} of the wallet
//  */
export const isWalletUpToDate = (status: AccountStatus): boolean => {
  return status.onChain.deployed && status.fullyMigrated
}

export interface ItemStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): Promise<void>
}

export class MemoryItemStore {
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] || null
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
  }

  removeItem(key: string): Promise<void> {
    delete this.store[key]
    return Promise.resolve()
  }
}

export class LocalStorage {
  private static _instance: ItemStore

  private constructor() {}

  static getInstance(): ItemStore {
    if (typeof window === 'object') {
      if (!LocalStorage._instance) {
        LocalStorage._instance = {
          getItem: (key: string) => window.localStorage.getItem(key),
          setItem: (key: string, value: string) => Promise.resolve(window.localStorage.setItem(key, value)),
          removeItem: (key: string) => Promise.resolve(window.localStorage.removeItem(key))
        }
      }
    } else {
      // noop local storage if window is not defined
      // TODO: perhaps add an in-memory local storage if we need?
      if (!LocalStorage._instance) {
        LocalStorage._instance = {
          getItem: (key: string) => null,
          setItem: (key: string, value: string) => Promise.resolve(),
          removeItem: (key: string) => Promise.resolve()
        }
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

export async function resolveArrayProperties<T>(
  object: Readonly<ethers.utils.Deferrable<T>> | Readonly<ethers.utils.Deferrable<T>>[]
): Promise<T> {
  if (Array.isArray(object)) {
    // T must include array type
    return Promise.all(object.map((o) => ethers.utils.resolveProperties(o))) as any
  }

  return ethers.utils.resolveProperties(object)
}
