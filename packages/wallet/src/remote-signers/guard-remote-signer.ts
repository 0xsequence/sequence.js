import { BigNumber, ethers, BytesLike } from 'ethers'
import { RemoteSigner } from './remote-signer'
import { Guard } from '@0xsequence/guard'
import { ChainId, ChainIdLike } from '@0xsequence/network'

const fetch = typeof global === 'object' ? global.fetch : window.fetch

export class GuardRemoteSigner extends RemoteSigner {
  private readonly _guard: Guard
  private readonly _address: string

  constructor(
    address: string,
    hostname: string,
    public isSequence: boolean = false,
    public defaultChainId: number = ChainId.MAINNET
  ) {
    super()
    this._guard = new Guard(hostname, fetch)
    this._address = address
  }

  async signMessageWithData(message: BytesLike, auxData?: BytesLike, chainId?: ChainIdLike): Promise<string> {
    const request = {
      msg: ethers.utils.hexlify(message),
      auxData: ethers.utils.hexlify(auxData ? auxData : []),
      chainId: chainId ? BigNumber.from(chainId).toNumber() : this.defaultChainId
    }
    const res = await this._guard.sign({ request: request })

    // TODO: The guard service doesn't include the EIP2126 signature type on it's reponse
    // maybe it should be more explicit and include it? the EIP2126 is only required for non-sequence signatures
    return this.isSequence ? res.sig : res.sig + '02'
  }

  async getAddress(): Promise<string> {
    return this._address
  }
}
