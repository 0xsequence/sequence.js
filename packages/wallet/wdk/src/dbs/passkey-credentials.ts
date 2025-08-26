import { Generic, Migration } from './generic.js'
import { IDBPDatabase, IDBPTransaction } from 'idb'
import { Address } from 'ox'
import { Extensions } from '@0xsequence/wallet-primitives'

const TABLE_NAME = 'passkey-credentials'

export type PasskeyCredential = {
  credentialId: string
  publicKey: Extensions.Passkeys.PublicKey
  walletAddress: Address.Address
  createdAt: string
}

export class PasskeyCredentials extends Generic<PasskeyCredential, 'credentialId'> {
  constructor(dbName: string = 'sequence-passkey-credentials') {
    super(dbName, TABLE_NAME, 'credentialId', [
      (
        db: IDBPDatabase<unknown>,
        _tx: IDBPTransaction<unknown, string[], 'versionchange'>,
        _event: IDBVersionChangeEvent,
      ) => {
        if (!db.objectStoreNames.contains(TABLE_NAME)) {
          const store = db.createObjectStore(TABLE_NAME)

          // Create an index on walletAddress for efficient lookups
          store.createIndex('walletAddress', 'walletAddress', { unique: false })
        }
      },
    ])
  }

  /**
   * Get all passkey credentials for a specific wallet address
   */
  async getByWallet(walletAddress: Address.Address): Promise<PasskeyCredential[]> {
    const store = await this.getStore('readonly')
    const index = store.index('walletAddress')
    return index.getAll(walletAddress)
  }

  /**
   * Get a passkey credential by credential ID
   */
  async getByCredentialId(credentialId: string): Promise<PasskeyCredential | undefined> {
    return this.get(credentialId)
  }

  /**
   * Store a new passkey credential
   */
  async storeCredential(
    credentialId: string,
    publicKey: Extensions.Passkeys.PublicKey,
    walletAddress: Address.Address,
  ): Promise<void> {
    const credential: PasskeyCredential = {
      credentialId,
      publicKey,
      walletAddress,
      createdAt: new Date().toISOString(),
    }

    await this.set(credential)
  }
}
