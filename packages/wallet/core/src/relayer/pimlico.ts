import { Constants, Payload } from '@0xsequence/wallet-primitives'
import { Bundler } from './bundler.js'
import { AbiFunction, Provider, Hex, Address } from 'ox'
import { UserOperation } from 'ox/erc4337'

type PimlicoGasPrice = {
  slow: {
    maxFeePerGas: Hex.Hex
    maxPriorityFeePerGas: Hex.Hex
  }
  standard: {
    maxFeePerGas: Hex.Hex
    maxPriorityFeePerGas: Hex.Hex
  }
  fast: {
    maxFeePerGas: Hex.Hex
    maxPriorityFeePerGas: Hex.Hex
  }
}

export class PimlicoBundler implements Bundler {
  public readonly kind: 'bundler' = 'bundler'
  public readonly id: string

  public readonly provider: Provider.Provider
  public readonly bundlerRpcUrl: string

  constructor(bundlerRpcUrl: string, provider: Provider.Provider) {
    this.id = `pimlico-erc4337-${bundlerRpcUrl}`
    this.provider = provider
    this.bundlerRpcUrl = bundlerRpcUrl
  }

  async isAvailable(wallet: Address.Address, chainId: bigint): Promise<boolean> {
    // TODO: This should not check if the wallet supports 4337, it should only check
    // if the bundler supports the same version the wallet announces
    const [result, providerChainId, code] = await Promise.all([
      this.provider.request({
        method: 'eth_call',
        params: [{ to: wallet, data: AbiFunction.encodeData(Constants.READ_ENTRYPOINT) }],
      }),
      this.provider.request({
        method: 'eth_chainId',
      }),
      this.provider.request({
        method: 'eth_getCode',
        params: [wallet, 'pending'],
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

  async relay(entrypoint: Address.Address, userOperation: UserOperation.RpcV07): Promise<{ opHash: Hex.Hex }> {
    const status = await this.bundlerRpc<any>('eth_sendUserOperation', [userOperation, entrypoint])
    return { opHash: status.opHash }
  }

  async estimateLimits(wallet: Address.Address, payload: Payload.Calls4337_07): Promise<Payload.Calls4337_07> {
    let maxFeePerGas = payload.maxFeePerGas
    let maxPriorityFeePerGas = payload.maxPriorityFeePerGas

    if (!maxFeePerGas || !maxPriorityFeePerGas) {
      const gasPrice = await this.bundlerRpc<PimlicoGasPrice>('pimlico_getUserOperationGasPrice', [])
      if (!maxFeePerGas) {
        maxFeePerGas = BigInt(gasPrice.standard.maxFeePerGas)
      }
      if (!maxPriorityFeePerGas) {
        maxPriorityFeePerGas = BigInt(gasPrice.standard.maxPriorityFeePerGas)
      }
    }

    // build a dummy op (v0.7 shape)
    const dummyOp = Payload.to4337UserOperation(payload, wallet, '0x000010000000000000000000000000000000000000000000')
    const rpcOp = UserOperation.toRpc(dummyOp)

    // ask the bundler
    const est = await this.bundlerRpc<any>('eth_estimateUserOperationGas', [rpcOp, payload.entrypoint])

    // fold the answer back in
    return {
      ...payload,
      callGasLimit: BigInt(est.callGasLimit),
      verificationGasLimit: BigInt(est.verificationGasLimit),
      preVerificationGas: BigInt(est.preVerificationGas),
      paymasterVerificationGasLimit: est.paymasterVerificationGasLimit
        ? BigInt(est.paymasterVerificationGasLimit)
        : payload.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: est.paymasterPostOpGasLimit
        ? BigInt(est.paymasterPostOpGasLimit)
        : payload.paymasterPostOpGasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    }
  }

  private async bundlerRpc<T>(method: string, params: any[]): Promise<T> {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    const res = await fetch(this.bundlerRpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error.message ?? 'bundler error')
    return json.result
  }
}
