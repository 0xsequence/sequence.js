import { Secp256k1, Address, Signature, PersonalMessage, Hash, Hex } from 'ox'
import { AuthKey as ProtoAuthKey, KeyType } from './nitro'
import { SecureStoreBackend } from './secure-store'
import { SubtleCryptoBackend } from './subtle-crypto'

const idbName = 'sequence-authkeys'
const idbStoreName = 'authkeys'

export abstract class AuthKey {
  protected _identitySigner?: `0x${string}`

  public abstract toProto(): ProtoAuthKey
  public abstract signMessage(payload: string): Promise<`0x${string}`>
  protected abstract store(): Promise<void>

  public get identitySigner(): `0x${string}` | undefined {
    return this._identitySigner
  }

  public async setIdentitySigner(signer: `0x${string}`) {
    this._identitySigner = signer
    await this.store()
  }

  public static async getOrCreate(storage: SecureStoreBackend, crypto?: SubtleCryptoBackend): Promise<AuthKey> {
    const authKey = await AuthKey.fromStorage(storage, crypto)
    if (authKey) {
      return authKey
    }
    return AuthKey.createRandom(storage, crypto)
  }

  public static async createRandom(storage: SecureStoreBackend, crypto?: SubtleCryptoBackend): Promise<AuthKey> {
    // TODO: if crypto is available, use secp256r1 instead.
    return AuthKeyP256K1.createRandom(storage, crypto)
  }

  public static async fromStorage(storage: SecureStoreBackend, crypto?: SubtleCryptoBackend): Promise<AuthKey | null> {
    // TODO: if crypto is available, use secp256r1 instead.
    return AuthKeyP256K1.fromStorage(storage, crypto)
  }
}

export class AuthKeyP256K1 extends AuthKey {
  private constructor(
    readonly storage: SecureStoreBackend,
    readonly privateKey: `0x${string}`,
  ) {
    super()
  }

  public static async createRandom(storage: SecureStoreBackend, _crypto?: SubtleCryptoBackend): Promise<AuthKeyP256K1> {
    const privateKey = Secp256k1.randomPrivateKey()
    const authKey = new AuthKeyP256K1(storage, privateKey)
    await authKey.store()
    return authKey
  }

  public static async fromStorage(
    storage: SecureStoreBackend,
    _crypto?: SubtleCryptoBackend,
  ): Promise<AuthKeyP256K1 | null> {
    const [signer, privateKey] = await storage.get(idbName, idbStoreName, 'p256k1')
    if (!privateKey) {
      return null
    }
    if (!privateKey.startsWith('0x')) {
      return null
    }
    const authKey = new AuthKeyP256K1(storage, privateKey as `0x${string}`)
    authKey._identitySigner = signer as `0x${string}`
    return authKey
  }

  public toProto(): ProtoAuthKey {
    const pubKey = Secp256k1.getPublicKey({ privateKey: this.privateKey })
    const address = Address.fromPublicKey(pubKey)
    return {
      keyType: KeyType.P256K1,
      publicKey: address,
    }
  }

  public async signMessage(payload: string): Promise<`0x${string}`> {
    const personalMessage = PersonalMessage.getSignPayload(Hex.fromString(payload))
    const signature = Secp256k1.sign({ payload: personalMessage, privateKey: this.privateKey })
    console.log({ payload, personalMessage, signature: Signature.toHex(signature) })
    return Signature.toHex(signature)
  }

  protected async store() {
    const validUntil = new Date(Date.now() + 1000 * 60 * 60 * 12) // 12 hours
    await this.storage.set(idbName, idbStoreName, 'p256k1', [this._identitySigner, this.privateKey], validUntil)
  }
}
