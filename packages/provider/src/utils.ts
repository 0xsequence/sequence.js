import { BigNumberish, BytesLike, ethers } from 'ethers'
import { sequenceContext, WalletContext } from '@0xsequence/network'
import { WalletConfig, addressOf, DecodedSignature, ConfigTracker } from '@0xsequence/config'
import { packMessageData } from '@0xsequence/utils'
import { isValidSignature as _isValidSignature, recoverConfig } from '@0xsequence/wallet'

export const recoverWalletConfig = async (
  address: string,
  digest: BytesLike,
  signature: string | DecodedSignature,
  chainId: BigNumberish,
  provider: ethers.providers.Provider,
  configTracker?: ConfigTracker,
  walletContext?: WalletContext,
): Promise<WalletConfig> => {
  const subDigest = packMessageData(address, chainId, digest)
  const config = await recoverConfig(
    subDigest,
    signature,
    provider,
    walletContext || sequenceContext,
    ethers.BigNumber.from(chainId).toNumber(),
    true,
    configTracker
  )

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
