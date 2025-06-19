import { Constants, Payload } from '@0xsequence/wallet-primitives'
import { Bundler } from './bundler.js'
import { Address } from 'ox/Address'
import { Hex } from 'ox/Hex'
import { AbiFunction, Provider } from 'ox'

export class ERC4337Bundler implements Bundler {
  public readonly id: string

  public readonly provider: Provider.Provider
  public readonly bundlerRpcUrl: string

  constructor(bundlerRpcUrl: string, provider: Provider.Provider) {
    this.id = `erc4337-${bundlerRpcUrl}`
    this.provider = provider
    this.bundlerRpcUrl = bundlerRpcUrl
  }

  async isAvailable(wallet: Address, chainId: bigint): Promise<boolean> {
    const [result, providerChainId] = await Promise.all([
      this.provider.request({
        method: 'eth_call',
        params: [{ to: wallet, data: AbiFunction.encodeData(Constants.READ_ENTRYPOINT) }],
      }),
      this.provider.request({
        method: 'eth_chainId',
      }),
    ])

    if (chainId !== BigInt(providerChainId)) {
      return false
    }

    if (result === '0x' || result === '0x0000000000000000000000000000000000000000') {
      return false
    }

    return true
  }

  relay(payload: Payload.Calls4337_07): Promise<{ opHash: Hex }> {
    throw new Error('Method not implemented.')
  }

  async estimateLimits(payload: Payload.Calls4337_07): Promise<Payload.Calls4337_07> {
    return payload
  }
}
