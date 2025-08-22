import { Address, Hex, Signature, Bytes, Hash } from 'ox'
import * as Client from './client/guard.gen.js'
import * as Types from './types.js'

export class Guard implements Types.Guard {
  private readonly guard?: Client.Guard
  public readonly address: Address.Address

  constructor(hostname: string, address: Address.Address, fetch?: Client.Fetch) {
    if (hostname && address) {
      this.guard = new Client.Guard(hostname, fetch ?? window.fetch)
    }
    this.address = address
  }

  async signPayload(
    wallet: Address.Address,
    chainId: number,
    type: Client.PayloadType,
    data: Bytes.Bytes,
    signatures?: Client.Signature[],
  ) {
    if (!this.guard || !this.address) {
      throw new Error('Guard not initialized')
    }

    const digest = Hash.keccak256(data)

    try {
      const res = await this.guard.signWith({
        signer: this.address,
        request: {
          chainId: chainId,
          msg: Hex.fromBytes(digest),
          wallet,
          payloadType: type,
          payloadData: Hex.fromBytes(data),
          signatures,
        },
      })

      Hex.assert(res.sig)
      return Signature.fromHex(res.sig)
    } catch (error) {
      console.error(error)
      throw new Error('Error signing with guard')
    }
  }
}
