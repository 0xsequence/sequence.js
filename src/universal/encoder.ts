import { utils, Wallet } from 'ethers'
import { Opts } from '../mts/types'

// TODO: impement universal txn-relayer and encoding that can work with generic contracts

export class Contract {
  abi: utils.Interface
  address: string

  constructor(abiStr: string, address: string) {
    this.abi = new utils.Interface(abiStr)
    this.address = address
  }

  async call(
    opts: Opts,
    signer: Wallet,
    methodName: string,
    params: any[]
  ): Promise<string> {
    const method = this.abi.functions[methodName]

    if (!method) {
      throw Error('method not found')
    }

    return method.encode(params)
  }
}
