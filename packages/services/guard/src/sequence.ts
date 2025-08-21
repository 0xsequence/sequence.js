import { Address, Hex, Signature, AbiParameters, Bytes } from 'ox'
import { Fetch, Guard } from './client/guard.gen.js'
import { GuardSigner as IGuardSigner } from './index.js'

export class GuardSigner implements IGuardSigner {
  private readonly guard?: Guard
  public readonly address: Address.Address

  constructor(hostname: string, address: Address.Address, fetch?: Fetch) {
    if (hostname && address) {
      this.guard = new Guard(hostname, fetch ?? window.fetch)
    }
    this.address = address
  }

  async sign(wallet: Address.Address, chainId: number, digest: Bytes.Bytes, message: Hex.Hex) {
    if (!this.guard || !this.address) {
      throw new Error('Guard not initialized')
    }

    const auxData = AbiParameters.encode(AbiParameters.from(['address', 'uint256', 'bytes', 'bytes']), [
      wallet,
      BigInt(chainId),
      message,
      '0x',
    ])

    try {
      const res = await this.guard.signWith({
        signer: this.address,
        request: {
          chainId: chainId,
          msg: Hex.fromBytes(digest),
          auxData,
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
