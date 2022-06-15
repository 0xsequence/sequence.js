import { ConfigTrackerDatabase, SignaturePart } from "."
import { DBSchema, IDBPDatabase, openDB } from 'idb'
import { DecodedSignaturePart, WalletConfig } from "@0xsequence/config"
import { WalletContext } from "@0xsequence/network"
import { TransactionBody } from "../config-tracker"
import { BigNumber, BigNumberish, ethers } from "ethers"

export interface LocalTrackerDBSchema extends DBSchema {
  'configs': {
    key: string, // ImageHash
    value: WalletConfig;
  };
  'signers': {
    value: {
      address: string,
      imageHash: string,
    };
    key: string; // ImageHash + Address
    indexes: { 'signer': string };
  },
  'wallets': {
    value: {
      imageHash: string,
      context: WalletContext,
    },
    key: string, // Address
  },
  'transactions': {
    value: TransactionBody,
    key: string // digest
  },
  'signatures': {
    value: {
      signature: DecodedSignaturePart,
      wallet: string,
      signer: string,
      digest: string,
      chainId: string,
      imageHash: string | undefined
    },
    key: string, // signer + digest + chainId,
    indexes: {
      'signer': string,
      'imagehash': string
    }
  }
}

export class IndexedDBLocalTracker implements ConfigTrackerDatabase {
  constructor(public dbName: string) {
    this.dbName = dbName
  }

  private _lazyDb: IDBPDatabase<LocalTrackerDBSchema> | undefined

  getDb = async (): Promise<IDBPDatabase<LocalTrackerDBSchema>> => {
    if (this._lazyDb) {
      return this._lazyDb
    }
  
    const dbName = this.dbName
    this._lazyDb = await openDB<LocalTrackerDBSchema>(dbName, 1, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`upgrading ${dbName} from ${oldVersion} to ${newVersion} - ${transaction}`)
        if (oldVersion === 0) {
          db.createObjectStore('configs')

          const signersProductStore = db.createObjectStore('signers')
          signersProductStore.createIndex('signer', 'address', { unique: false })
          db.createObjectStore('wallets')
          db.createObjectStore('transactions')

          const signaturesProductStore = db.createObjectStore('signatures')
          signaturesProductStore.createIndex('signer', 'signer', { unique: false })
          signaturesProductStore.createIndex('imagehash', 'imageHash', { unique: false })
        }
      },
      blocked() {
        console.log(`blocked ${dbName}`)
      },
      blocking() {
        console.log(`blocking ${dbName}`)
      },
      terminated() {
        console.log(`terminated ${dbName}`)
      }
    })
  
    return this._lazyDb
  }

  async allConfigs(): Promise<WalletConfig[]> {
    const db = await this.getDb()
    return db.getAll('configs')
  }

  async allCounterFactualWallets(): Promise<{ context: WalletContext; imageHash: string }[]> {
    const db = await this.getDb()
    return db.getAll('wallets')
  }

  async allTransactions(): Promise<(TransactionBody & { digest: string })[]> {
    const db = await this.getDb()
    const tx = db.transaction('transactions', 'readonly')
    const store = tx.objectStore('transactions')

    let cursor = await store.openCursor()

    const res: Array<TransactionBody & { digest: string }> = []
    while (cursor) {
      const { value, key } = cursor
      res.push({ ...value, digest: key })
      cursor = await cursor.continue()
    }

    return res
  }

  async allSignatures(): Promise<SignaturePart[]> {
    const db = await this.getDb()
    const sigs = await db.getAll('signatures')
    return sigs.map((s) => ({ ...s, chainId: ethers.BigNumber.from(s.chainId) }))
  }

  saveWalletConfig: (args: { imageHash: string; config: WalletConfig }) => Promise<void> = async (args) => {
    const db = await this.getDb()

    // Store the config in imageHash -> config db
    await db.put('configs', args.config, args.imageHash)

    // Store every wallet in address -> imageHash db in bulk
    const tx = db.transaction('signers', 'readwrite')
    for (const signer of args.config.signers) {
      tx.store.put({
        address: signer.address,
        imageHash: args.imageHash,
      }, `${args.imageHash}${signer.address}`)
    }

    await tx.done
  }

  configOfImageHash: (args: { imageHash: string }) => Promise<WalletConfig | undefined> = async (args) => {
    const db = await this.getDb()
    return db.get('configs', args.imageHash)
  }

  imageHashesOfSigner: (args: { signer: string }) => Promise<string[]> = async (args) => {
    const db = await this.getDb()

    const res = await db.getAllFromIndex('signers', 'signer', args.signer)
    return res.map(x => x.imageHash)
  }

  saveCounterFactualWallet: (args: { wallet: string; imageHash: string; context: WalletContext }) => Promise<void> = async (args) => {
    const db = await this.getDb()
    await db.put('wallets', { imageHash: args.imageHash, context: args.context }, args.wallet)
  }

  imageHashOfCounterFactualWallet: (args: { context: WalletContext; wallet: string }) => Promise<string | undefined> = async (args) => {
    const db = await this.getDb()
    const candidates = await db.getAll('wallets', args.wallet)

    const factory = args.context.factory.toLowerCase()
    const mainModule = args.context.mainModule.toLowerCase()

    for (const candidate of candidates) {
      if (
        candidate.context.factory.toLowerCase() === factory &&
        candidate.context.mainModule.toLowerCase() === mainModule
      ) {
        return candidate.imageHash
      }
    }
  
    return undefined
  }

  savePresignedTransaction: (args: { digest: string; body: TransactionBody }) => Promise<void> = async (args) => {
    const db = await this.getDb()
    await db.put('transactions', args.body, args.digest)
  }

  transactionWithDigest: (args: { digest: string }) => Promise<TransactionBody | undefined> = async (args) => {
    const db = await this.getDb()
    const res = await db.get('transactions', args.digest)
    return res ? { ...res, nonce: ethers.BigNumber.from(res.nonce), gapNonce: ethers.BigNumber.from(res.gapNonce) } : undefined
  }

  saveSignatureParts: (args: { wallet: string; digest: string; chainId: BigNumber; signatures: { part: DecodedSignaturePart, signer: string }[]; imageHash?: string | undefined }) => Promise<any> = async (args) => {
    const db = await this.getDb()
    const chainIdString = args.chainId.toString()

    const tx = db.transaction('signatures', 'readwrite')
    for (const signature of args.signatures) {
      tx.store.put({
        signature: signature.part,
        wallet: args.wallet,
        signer: signature.signer,
        digest: args.digest,
        chainId: chainIdString,
        imageHash: args.imageHash
      }, `${signature.signer}${args.digest}${chainIdString}`)
    }

    await tx.done
  }

  getSignaturePart: (args: { signer: string; digest: string; chainId: BigNumberish }) => Promise<SignaturePart | undefined> = async (args) => {
    const db = await this.getDb()
    const chainIdString = ethers.BigNumber.from(args.chainId).toString()
    const res = await db.get('signatures', `${args.signer}${args.digest}${chainIdString}`)
    return res ? { ...res, chainId: ethers.BigNumber.from(res.chainId) } : undefined
  }

  getSignaturePartsForAddress: (args: { signer: string; chainId?: BigNumberish | undefined }) => Promise<SignaturePart[]> = async (args) => {
    const db = await this.getDb()
    let res = await db.getAllFromIndex('signatures', 'signer', args.signer)

    // If chainId is defined, filter by chainId
    if (args.chainId) {
      const chainIdString = ethers.BigNumber.from(args.chainId).toString()
      res = res.filter(x => x.chainId === chainIdString)
    }

    return res.map(x => ({ ...x, chainId: ethers.BigNumber.from(x.chainId) }))
  }

  getSignaturePartsForImageHash: (args: { imageHash: string }) => Promise<SignaturePart[]> = async (args) => {
    const db = await this.getDb()
    const res = await db.getAllFromIndex('signatures', 'imagehash', args.imageHash)
    return res.map(x => ({ ...x, chainId: ethers.BigNumber.from(x.chainId) }))
  }
}
