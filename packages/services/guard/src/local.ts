import { Address, Hex, Bytes, Secp256k1 } from 'ox'
import * as Client from './client/guard.gen.js'
import * as Types from './types.js'

export class Guard implements Types.Guard {
  public readonly address: Address.Address

  constructor(private readonly privateKey: Hex.Hex) {
    const publicKey = Secp256k1.getPublicKey({ privateKey: this.privateKey })
    this.address = Address.fromPublicKey(publicKey)
  }

  async signPayload(
    _wallet: Address.Address,
    _chainId: number,
    _type: Client.PayloadType,
    digest: Bytes.Bytes,
    _message: Bytes.Bytes,
    _signatures?: Client.Signature[],
    _token?: Client.AuthToken,
  ) {
    return Secp256k1.sign({ privateKey: this.privateKey, payload: digest })
  }
}
