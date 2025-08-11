import { Hex, Bytes } from 'ox'
import { canonicalize } from 'json-canonicalize'
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
    const params = challenge.getCommitParams()
    const signature = await authKey.sign(Bytes.fromString(canonicalize(params)))
    return this.rpc.commitVerifier({
      params,
      authKey: {
        address: authKey.address,
        keyType: authKey.keyType,
      },
      signature,
    })
  }

  async completeAuth(authKey: AuthKey, challenge: Challenge) {
    const params = {
      ...challenge.getCompleteParams(),
      signerType: KeyType.Ethereum_Secp256k1,
    }
    const signature = await authKey.sign(Bytes.fromString(canonicalize(params)))
    return this.rpc.completeAuth({
      params,
      authKey: {
        address: authKey.address,
        keyType: authKey.keyType,
      },
      signature,
    })
  }

  async sign(authKey: AuthKey, digest: Bytes.Bytes) {
    const params = {
      signer: {
        address: authKey.signer,
        keyType: KeyType.Ethereum_Secp256k1,
      },
      digest: Hex.fromBytes(digest),
      nonce: Hex.random(16),
    }
    const res = await this.rpc.sign({
      params,
      authKey: {
        address: authKey.address,
        keyType: authKey.keyType,
      },
      signature: await authKey.sign(Bytes.fromString(canonicalize(params))),
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
