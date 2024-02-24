import { ethers, BytesLike } from 'ethers'
import { messageIsExemptFromEIP191Prefix } from './eip191exceptions'
import { AccountStatus } from '@0xsequence/account'
import { commons } from '@0xsequence/core'
import { encodeMessageDigest, TypedData, encodeTypedDataDigest } from '@0xsequence/utils'

const eip191prefix = ethers.toUtf8Bytes('\x19Ethereum Signed Message:\n')

export const messageToBytes = (message: BytesLike): Uint8Array => {
  if (ethers.isBytesLike(message)) {
    return ethers.getBytes(message)
  }

  return ethers.toUtf8Bytes(message)
}

export const prefixEIP191Message = (message: BytesLike): BytesLike => {
  const messageBytes = messageToBytes(message)
  if (messageIsExemptFromEIP191Prefix(messageBytes)) {
    return messageBytes
  } else {
    const res = ethers.concat([eip191prefix, ethers.toUtf8Bytes(String(messageBytes.length)), messageBytes])
    return res
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
    prefixAsNumber = Number(ethers.toUtf8String(ethereumSignedMessagePartSlicedArray.slice(0, maxPrefixCharLength)))
  } catch {
    prefixAsNumber = Number(ethers.toBeHex(ethers.hexlify(ethereumSignedMessagePartSlicedArray.slice(0, maxPrefixCharLength))))
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
  provider: ethers.Provider
): Promise<boolean> => {
  const reader = new commons.reader.OnChainReader(provider)
  return reader.isValidSignature(address, digest, sig)
}

// Verify message signature
export const isValidMessageSignature = async (
  address: string,
  message: string | Uint8Array,
  signature: string,
  provider: ethers.Provider
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
  provider: ethers.Provider
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

  removeItem(key: string): void

  onItemChange(key: string, cb: (value: string | null) => void): () => void
}

export class MemoryItemStore implements ItemStore {
  private callbacks: { key: string; cb: (value: string | null) => void }[] = []
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] || null
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
    this.callbacks.filter(c => c.key === key).forEach(c => c.cb(value))
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  onItemChange(key: string, cb: (value: string | null) => void): () => void {
    this.callbacks.push({ key, cb })

    return () => {
      this.callbacks = this.callbacks.filter(c => c.cb !== cb)
    }
  }
}

export class LocalStorage implements ItemStore {
  private callbacks: { key: string; cb: (value: string | null) => void }[] = []

  static isAvailable(): boolean {
    return typeof window === 'object' && typeof window.localStorage === 'object'
  }

  constructor() {
    if (!LocalStorage.isAvailable()) {
      throw new Error('LocalStorage is not available')
    }

    window.addEventListener('storage', e => {
      const { key } = e
      const cb = this.callbacks.filter(c => c.key === key)
      cb.forEach(c => c.cb(this.getItem(key!)))
    })
  }

  getItem(key: string): string | null {
    return window.localStorage.getItem(key)
  }

  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value)

    // Trigger callbacks
    // NOTICE: the event is not triggered on the same window
    this.callbacks.filter(c => c.key === key).forEach(c => c.cb(value))
  }

  removeItem(key: string): void {
    window.localStorage.removeItem(key)

    // Trigger callbacks
    // NOTICE: the event is not triggered on the same window
    this.callbacks.filter(c => c.key === key).forEach(c => c.cb(null))
  }

  onItemChange(key: string, cb: (value: string | null) => void): () => void {
    this.callbacks.push({ key, cb })

    return () => {
      this.callbacks = this.callbacks.filter(c => c.cb !== cb)
    }
  }
}

export function useBestStore(): ItemStore {
  if (LocalStorage.isAvailable()) {
    return new LocalStorage()
  }

  return new MemoryItemStore()
}

export async function resolveArrayProperties<T>(object: Readonly<T> | Readonly<T>[]): Promise<T> {
  if (Array.isArray(object)) {
    // T must include array type
    return Promise.all(object.map(o => ethers.resolveProperties(o))) as any
  }

  return ethers.resolveProperties(object)
}

// ethers poll util from ethers v5.7
export interface OnceBlockable {
  once(eventName: 'block', handler: () => void): void
}

export interface OncePollable {
  once(eventName: 'poll', handler: () => void): void
}

export type PollOptions = {
  timeout?: number
  floor?: number
  ceiling?: number
  interval?: number
  retryLimit?: number
  onceBlock?: OnceBlockable
  oncePoll?: OncePollable
}

export function poll<T>(func: () => Promise<T>, options: PollOptions = {}): Promise<T> {
  options = shallowCopy(options)
  if (options.floor == null) {
    options.floor = 0
  }
  if (options.ceiling == null) {
    options.ceiling = 10000
  }
  if (options.interval == null) {
    options.interval = 250
  }

  return new Promise(function (resolve, reject) {
    let timer: NodeJS.Timeout | undefined
    let done: boolean = false

    // Returns true if cancel was successful. Unsuccessful cancel means we're already done.
    const cancel = (): boolean => {
      if (done) {
        return false
      }
      done = true
      if (timer) {
        clearTimeout(timer)
      }
      return true
    }

    if (options.timeout) {
      timer = setTimeout(() => {
        if (cancel()) {
          reject(new Error('timeout'))
        }
      }, options.timeout)
    }

    let attempt = 0
    function check() {
      return func().then(
        function (result) {
          // If we have a result, or are allowed null then we're done
          if (result !== undefined) {
            if (cancel()) {
              resolve(result)
            }
          } else if (options.oncePoll) {
            options.oncePoll.once('poll', check)
          } else if (options.onceBlock) {
            options.onceBlock.once('block', check)

            // Otherwise, exponential back-off (up to 10s) our next request
          } else if (!done) {
            attempt++
            if (attempt > options.retryLimit!) {
              if (cancel()) {
                reject(new Error('retry limit reached'))
              }
              return
            }

            let timeout = options.interval! * parseInt(String(Math.random() * Math.pow(2, attempt)))
            if (timeout < options.floor!) {
              timeout = options.floor!
            }
            if (timeout > options.ceiling!) {
              timeout = options.ceiling!
            }

            setTimeout(check, timeout)
          }

          return null
        },
        function (error) {
          if (cancel()) {
            reject(error)
          }
        }
      )
    }
    check()
  })
}

export function shallowCopy<T>(object: T): T {
  const result: any = {}
  for (const key in object) {
    result[key] = object[key]
  }
  return result
}
