import fetchPonyfill from 'fetch-ponyfill'
import { BigNumber, ethers, BytesLike } from 'ethers'
import { RemoteSigner } from './remote-signer'
import { GuarddService } from '@0xsequence/guard'
import { ChainId, ChainIdLike } from '@0xsequence/network'

export class GuardRemoteSigner extends RemoteSigner {
  private readonly _guardd: GuarddService
  private readonly _address: string

  constructor(
    address: string,
    hostname: string,
    public isSequence: boolean = false,
    public defaultChainId: number = ChainId.MAINNET
  ) {
    super()
    this._guardd = new GuarddService(hostname, fetchPonyfill().fetch)
    this._address = address
  }

  async signMessageWithData(message: BytesLike, auxData?: BytesLike, chainId?: ChainIdLike): Promise<string> {
    const request = {
      msg: ethers.utils.hexlify(message),
      auxData: ethers.utils.hexlify(auxData ? auxData : []),
      chainId: chainId ? BigNumber.from(chainId).toNumber() : this.defaultChainId
    }
    const res = await this._guardd.sign({ request: request })

    // TODO: The guardd service doesn't include the EIP2126 signature type on it's reponse
    // maybe it should be more explicit and include it? the EIP2126 is only required for non-sequence signatures
    return this.isSequence ? res.sig : res.sig + '02'
  }

  async getAddress(): Promise<string> {
    return this._address
  }
}
