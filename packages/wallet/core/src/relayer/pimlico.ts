import { Payload } from '@0xsequence/wallet-primitives'
import { Bundler } from './bundler.js'
import { Provider, Hex, Address, RpcTransport } from 'ox'
import { UserOperation } from 'ox/erc4337'
import { OperationStatus } from './relayer.js'

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

  constructor(bundlerRpcUrl: string, provider: Provider.Provider | string) {
    this.id = `pimlico-erc4337-${bundlerRpcUrl}`
    this.provider = typeof provider === 'string' ? Provider.from(RpcTransport.fromHttp(provider)) : provider
    this.bundlerRpcUrl = bundlerRpcUrl
  }

  async isAvailable(entrypoint: Address.Address, chainId: bigint): Promise<boolean> {
    const [bundlerChainId, supportedEntryPoints] = await Promise.all([
      this.bundlerRpc<string>('eth_chainId', []),
      this.bundlerRpc<Address.Address[]>('eth_supportedEntryPoints', []),
    ])

    if (chainId !== BigInt(bundlerChainId)) {
      return false
    }

    return supportedEntryPoints.some((ep) => Address.isEqual(ep, entrypoint))
  }

  async relay(entrypoint: Address.Address, userOperation: UserOperation.RpcV07): Promise<{ opHash: Hex.Hex }> {
    const status = await this.bundlerRpc<Hex.Hex>('eth_sendUserOperation', [userOperation, entrypoint])
    console.log('send user opperation response', status)
    return { opHash: status }
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

  async status(opHash: Hex.Hex, _chainId: bigint): Promise<OperationStatus> {
    try {
      type PimlicoStatusResp = {
        status: 'not_found' | 'not_submitted' | 'submitted' | 'rejected' | 'included' | 'failed' | 'reverted'
        transactionHash: Hex.Hex | null
      }

      let pimlico: PimlicoStatusResp | undefined
      try {
        pimlico = await this.bundlerRpc<PimlicoStatusResp>('pimlico_getUserOperationStatus', [opHash])
      } catch (_) {
        /* ignore - not Pimlico or endpoint down */
      }

      if (pimlico) {
        switch (pimlico.status) {
          case 'not_submitted':
          case 'submitted':
            return { status: 'pending' }
          case 'rejected':
            return { status: 'failed', reason: 'rejected by bundler' }
          case 'failed':
          case 'reverted':
            return {
              status: 'failed',
              transactionHash: pimlico.transactionHash ?? undefined,
              reason: pimlico.status,
            }
          case 'included':
            // fall through to receipt lookup for full info
            break
          case 'not_found':
          default:
            return { status: 'unknown' }
        }
      }

      // Fallback to standard method
      const receipt = await this.bundlerRpc<any>('eth_getUserOperationReceipt', [opHash])

      if (!receipt) return { status: 'pending' }

      const txHash: Hex.Hex | undefined =
        (receipt.receipt?.transactionHash as Hex.Hex) ?? (receipt.transactionHash as Hex.Hex) ?? undefined

      const ok = receipt.success === true || receipt.receipt?.status === '0x1' || receipt.receipt?.status === 1

      return ok
        ? { status: 'confirmed', transactionHash: txHash ?? opHash, data: receipt }
        : {
            status: 'failed',
            transactionHash: txHash,
            reason: receipt.revertReason ?? 'UserOp reverted',
          }
    } catch (err: any) {
      console.error('[PimlicoBundler.status]', err)
      return { status: 'unknown', reason: err?.message ?? 'status lookup failed' }
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
