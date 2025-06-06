import { Hex, Bytes } from 'ox'
import {
  CommitVerifierReturn,
  CompleteAuthReturn,
  IdentityInstrument as IdentityInstrumentRpc,
  KeyType,
  IdentityType,
  AuthMode,
} from './identity-instrument.gen.js'
import { Challenge } from './challenge.js'

export type { CommitVerifierReturn, CompleteAuthReturn }
export { KeyType, IdentityType, AuthMode }
export * from './challenge.js'

export class IdentityInstrument {
  private rpc: IdentityInstrumentRpc

  constructor(hostname: string, fetch = window.fetch) {
    this.rpc = new IdentityInstrumentRpc(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
  }

  async commitVerifier(authKey: AuthKey, challenge: Challenge) {
    return this.rpc.commitVerifier({
      params: {
        ...challenge.getCommitParams(),
        authKey: {
          address: authKey.address,
          keyType: authKey.keyType,
        },
      },
    })
  }

  async completeAuth(authKey: AuthKey, challenge: Challenge) {
    return this.rpc.completeAuth({
      params: {
        ...challenge.getCompleteParams(),
        signerType: KeyType.Secp256k1,
        authKey: {
          address: authKey.address,
          keyType: authKey.keyType,
        },
      },
    })
  }

  async sign(authKey: AuthKey, digest: Bytes.Bytes) {
    const res = await this.rpc.sign({
      params: {
        signer: {
          address: authKey.signer,
          keyType: KeyType.Secp256k1,
        },
        digest: Hex.fromBytes(digest),
        authKey: {
          address: authKey.address,
          keyType: authKey.keyType,
        },
        signature: await authKey.sign(digest),
      },
    })
    Hex.assert(res.signature)
    return res.signature
  }
}

export interface AuthKey {
  signer: string
  address: string
  keyType: KeyType
  sign(digest: Bytes.Bytes): Promise<Hex.Hex>
}
