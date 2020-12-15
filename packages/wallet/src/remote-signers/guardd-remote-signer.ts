import { TransactionRequest, Provider } from '@ethersproject/providers'
import { BytesLike, ethers } from 'ethers'
import { Deferrable } from 'ethers/lib/utils'
import fetchPonyfill from 'fetch-ponyfill'
import { RemoteSigner } from './remote-signer'
import { GuarddService } from '@0xsequence/guard'

export class GuarddRemoteSigner extends RemoteSigner {
  private readonly _guardd: GuarddService
  private readonly _address: string

  constructor(address: string, hostname: string) {
    super()
    this._guardd = new GuarddService(hostname, fetchPonyfill().fetch)
    this._address = address
  }

  async signMessageWithData(message: BytesLike, auxData?: BytesLike): Promise<string> {
    const request = { msg: ethers.utils.hexlify(message), auxData: ethers.utils.hexlify(auxData ? auxData : []) }
    const res = await this._guardd.sign({ request: request })
    return res.sig
  }

  async getAddress(): Promise<string> {
    return this._address
  }

  signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
    throw new Error('Method not implemented.')
  }

  connect(provider: Provider): ethers.Signer {
    throw new Error('Method not implemented.')
  }
}
