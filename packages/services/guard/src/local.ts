import { Address, Hex, Bytes, Secp256k1, Hash } from 'ox'
import * as Client from './client/guard.gen.js'
import * as Types from './types.js'

export class Guard implements Types.Guard {
  public readonly address: Address.Address

  constructor(private readonly privateKey: Hex.Hex) {
    const publicKey = Secp256k1.getPublicKey({ privateKey: this.privateKey })
    this.address = Address.fromPublicKey(publicKey)
  }

  async signPayload(
    wallet: Address.Address,
    chainId: number,
    type: Client.PayloadType,
    data: Bytes.Bytes,
    signatures?: Client.Signature[],
  ) {
    const digest = Hash.keccak256(data)
    return Secp256k1.sign({ privateKey: this.privateKey, payload: digest })
  }
}
