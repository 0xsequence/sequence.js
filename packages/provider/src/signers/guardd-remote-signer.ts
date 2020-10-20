import { RemoteSigner } from "./remote-signer"
import { BytesLike, ethers } from 'ethers'
import { TransactionRequest, Provider } from '@ethersproject/providers'
import { GuarddService } from "./remoteclient/guardd.gen"
import * as pony from 'fetch-ponyfill'
import { Deferrable } from "ethers/lib/utils"


export class GuarddRemoteSigner extends RemoteSigner {
  private readonly _guardd: GuarddService
  private readonly _address: string

  constructor(address: string, hostname: string) {
    super()
    this._guardd = new GuarddService(hostname, pony().fetch)
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
    throw new Error("Method not implemented.")
  }
  connect(provider: Provider): ethers.Signer {
    throw new Error("Method not implemented.")
  }
}
