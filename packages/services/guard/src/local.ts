import { Address, Hex, Bytes, Secp256k1 } from 'ox'
import { GuardSigner as IGuardSigner } from './index.js'

export class GuardSigner implements IGuardSigner {
  public readonly address: Address.Address

  constructor(private readonly privateKey: Hex.Hex) {
    const publicKey = Secp256k1.getPublicKey({ privateKey: this.privateKey })
    this.address = Address.fromPublicKey(publicKey)
  }

  async sign(wallet: Address.Address, chainId: bigint, digest: Bytes.Bytes, message: Hex.Hex) {
    return Secp256k1.sign({ privateKey: this.privateKey, payload: digest })
  }
}
