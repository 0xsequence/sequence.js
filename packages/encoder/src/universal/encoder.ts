import { utils, Wallet } from 'ethers'

import { MetaTxnOpts } from '../tokens/types'

// TODO: impement universal txn-relayer and encoding that can work with generic contracts

export class UniversalEncoder {
  abi: utils.Interface
  address: string

  constructor(abiStr: string, address: string) {
    this.abi = new utils.Interface(abiStr)
    this.address = address
  }

  async call(opts: MetaTxnOpts, signer: Wallet, methodName: string, params: any[]): Promise<string> {
    const method = this.abi.functions[methodName]

    if (!method) {
      throw Error('method not found')
    }

    return method.encode(params)
  }
}
