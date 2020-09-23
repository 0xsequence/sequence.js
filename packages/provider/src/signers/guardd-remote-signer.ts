import { RemoteSigner } from "./remote-signer"
import { ethers, Signer as AbstractSigner } from 'ethers'
import { Arrayish } from "ethers/utils"
import { GuarddService } from "./remoteclient/guardd.gen"
import * as pony from 'fetch-ponyfill'


export class GuarddRemoteSigner extends RemoteSigner {
  private readonly _guardd: GuarddService
  private readonly _address: string

  constructor(address: string, hostname: string) {
    super()
    this._guardd = new GuarddService(hostname, pony().fetch)
    this._address = address
  }

  async signMessageWithData(message: Arrayish, auxData?: Arrayish): Promise<string> {
    const request = { msg: ethers.utils.hexlify(message), auxData: ethers.utils.hexlify(auxData ? auxData : []) }
    const res = await this._guardd.sign({ request: request })
    return res.sig
  }

  async getAddress(): Promise<string> {
    return this._address
  }
}
