import fetchPonyfill from 'fetch-ponyfill'
import { TransactionRequest, Provider } from '@ethersproject/providers'
import { ethers, BytesLike } from 'ethers'
import { Deferrable } from '@ethersproject/properties'
import { RemoteSigner } from './remote-signer'
import { GuarddService } from '@0xsequence/guard'

export class GuardRemoteSigner extends RemoteSigner {
  private readonly _guardd: GuarddService
  private readonly _address: string

  constructor(address: string, hostname: string, public isSequence: boolean = false) {
    super()
    this._guardd = new GuarddService(hostname, fetchPonyfill().fetch)
    this._address = address
  }

  async signMessageWithData(message: BytesLike, auxData?: BytesLike): Promise<string> {
    const request = { msg: ethers.utils.hexlify(message), auxData: ethers.utils.hexlify(auxData ? auxData : []) }
    const res = await this._guardd.sign({ request: request })

    // TODO: The guardd service doesn't include the EIP2126 signature type on it's reponse
    // maybe it should be more explicit and include it? the EIP2126 is only required for non-sequence signatures
    return this.isSequence ? res.sig : res.sig + '02'
  }

  async getAddress(): Promise<string> {
    return this._address
  }

}
