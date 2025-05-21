import { AuthKey as ProtoAuthKey } from './nitro'
import { SecureStoreBackend } from './secure-store'
import { SubtleCryptoBackend } from './subtle-crypto'
export declare abstract class AuthKey {
  protected _identitySigner?: `0x${string}`
  abstract toProto(): ProtoAuthKey
  abstract signMessage(payload: string): Promise<`0x${string}`>
  protected abstract store(): Promise<void>
  get identitySigner(): `0x${string}` | undefined
  setIdentitySigner(signer: `0x${string}`): Promise<void>
  static getOrCreate(storage: SecureStoreBackend, crypto?: SubtleCryptoBackend): Promise<AuthKey>
  static createRandom(storage: SecureStoreBackend, crypto?: SubtleCryptoBackend): Promise<AuthKey>
  static fromStorage(storage: SecureStoreBackend, crypto?: SubtleCryptoBackend): Promise<AuthKey | null>
}
export declare class AuthKeyP256K1 extends AuthKey {
  readonly storage: SecureStoreBackend
  readonly privateKey: `0x${string}`
  private constructor()
  static createRandom(storage: SecureStoreBackend, _crypto?: SubtleCryptoBackend): Promise<AuthKeyP256K1>
  static fromStorage(storage: SecureStoreBackend, _crypto?: SubtleCryptoBackend): Promise<AuthKeyP256K1 | null>
  toProto(): ProtoAuthKey
  signMessage(payload: string): Promise<`0x${string}`>
  protected store(): Promise<void>
}
//# sourceMappingURL=authkey.d.ts.map
