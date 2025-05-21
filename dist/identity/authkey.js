'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.AuthKeyP256K1 = exports.AuthKey = void 0
const ox_1 = require('ox')
const nitro_1 = require('./nitro')
const idbName = 'sequence-authkeys'
const idbStoreName = 'authkeys'
class AuthKey {
  _identitySigner
  get identitySigner() {
    return this._identitySigner
  }
  async setIdentitySigner(signer) {
    this._identitySigner = signer
    await this.store()
  }
  static async getOrCreate(storage, crypto) {
    const authKey = await AuthKey.fromStorage(storage, crypto)
    if (authKey) {
      return authKey
    }
    return AuthKey.createRandom(storage, crypto)
  }
  static async createRandom(storage, crypto) {
    // TODO: if crypto is available, use secp256r1 instead.
    return AuthKeyP256K1.createRandom(storage, crypto)
  }
  static async fromStorage(storage, crypto) {
    // TODO: if crypto is available, use secp256r1 instead.
    return AuthKeyP256K1.fromStorage(storage, crypto)
  }
}
exports.AuthKey = AuthKey
class AuthKeyP256K1 extends AuthKey {
  storage
  privateKey
  constructor(storage, privateKey) {
    super()
    this.storage = storage
    this.privateKey = privateKey
  }
  static async createRandom(storage, _crypto) {
    const privateKey = ox_1.Secp256k1.randomPrivateKey()
    const authKey = new AuthKeyP256K1(storage, privateKey)
    await authKey.store()
    return authKey
  }
  static async fromStorage(storage, _crypto) {
    const result = await storage.get(idbName, idbStoreName, 'p256k1')
    if (!result) {
      return null
    }
    const [signer, privateKey] = result
    if (!privateKey.startsWith('0x')) {
      return null
    }
    const authKey = new AuthKeyP256K1(storage, privateKey)
    authKey._identitySigner = signer
    return authKey
  }
  toProto() {
    const pubKey = ox_1.Secp256k1.getPublicKey({ privateKey: this.privateKey })
    const address = ox_1.Address.fromPublicKey(pubKey)
    return {
      keyType: nitro_1.KeyType.P256K1,
      publicKey: address,
    }
  }
  async signMessage(payload) {
    const personalMessage = ox_1.PersonalMessage.getSignPayload(ox_1.Hex.fromString(payload))
    const signature = ox_1.Secp256k1.sign({ payload: personalMessage, privateKey: this.privateKey })
    console.log({ payload, personalMessage, signature: ox_1.Signature.toHex(signature) })
    return ox_1.Signature.toHex(signature)
  }
  async store() {
    const validUntil = new Date(Date.now() + 1000 * 60 * 60 * 12) // 12 hours
    await this.storage.set(idbName, idbStoreName, 'p256k1', [this._identitySigner, this.privateKey], validUntil)
  }
}
exports.AuthKeyP256K1 = AuthKeyP256K1
