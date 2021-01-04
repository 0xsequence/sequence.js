import fetchPonyfill from 'fetch-ponyfill'
import { TransactionRequest, Provider } from '@ethersproject/providers'
import { ethers, BytesLike } from 'ethers'
import { Deferrable } from '@ethersproject/properties'
import { RemoteSigner } from './remote-signer'
import { GuarddService } from '@0xsequence/guard'

export class GuardRemoteSigner extends RemoteSigner {
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
    throw new Error('signTransaction method is not supported in GuardRemoteSigner')
  }

  connect(provider: Provider): ethers.Signer {
    throw new Error('connect method is not supported in GuardRemoteSigner')
  }
}
