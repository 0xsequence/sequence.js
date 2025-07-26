import { Address, Payload } from '@0xsequence/wallet-primitives'
import { Bundler } from '../bundler.js'
import { Provider, Hex, RpcTransport } from 'ox'
import { UserOperation } from 'ox/erc4337'
import { OperationStatus } from '../relayer.js'

type FeePerGasPair = {
  maxFeePerGas: Hex.Hex | bigint
  maxPriorityFeePerGas: Hex.Hex | bigint
}

type PimlicoGasPrice = {
  slow: FeePerGasPair
  standard: FeePerGasPair
  fast: FeePerGasPair
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

  async isAvailable(entrypoint: Address.Checksummed, chainId: bigint): Promise<boolean> {
    const [bundlerChainId, supportedEntryPoints] = await Promise.all([
      this.bundlerRpc<string>('eth_chainId', []),
      this.bundlerRpc<Address.Checksummed[]>('eth_supportedEntryPoints', []),
    ])

    if (chainId !== BigInt(bundlerChainId)) {
      return false
    }

    return supportedEntryPoints.some((ep) => Address.isEqual(ep, entrypoint))
  }

  async relay(entrypoint: Address.Checksummed, userOperation: UserOperation.RpcV07): Promise<{ opHash: Hex.Hex }> {
    const status = await this.bundlerRpc<Hex.Hex>('eth_sendUserOperation', [userOperation, entrypoint])
    return { opHash: status }
  }

  async estimateLimits(
    wallet: Address.Checksummed,
    payload: Payload.Calls4337_07,
  ): Promise<
    {
      speed?: 'slow' | 'standard' | 'fast'
      payload: Payload.Calls4337_07
    }[]
  > {
    const gasPrice = await this.bundlerRpc<PimlicoGasPrice>('pimlico_getUserOperationGasPrice', [])

    const dummyOp = Payload.to4337UserOperation(payload, wallet, '0x000010000000000000000000000000000000000000000000')
    const rpcOp = UserOperation.toRpc(dummyOp)
    const est = await this.bundlerRpc<any>('eth_estimateUserOperationGas', [rpcOp, payload.entrypoint])

    const estimatedFields = {
      callGasLimit: BigInt(est.callGasLimit),
      verificationGasLimit: BigInt(est.verificationGasLimit),
      preVerificationGas: BigInt(est.preVerificationGas),
      paymasterVerificationGasLimit: est.paymasterVerificationGasLimit
        ? BigInt(est.paymasterVerificationGasLimit)
        : payload.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: est.paymasterPostOpGasLimit
        ? BigInt(est.paymasterPostOpGasLimit)
        : payload.paymasterPostOpGasLimit,
    }

    const passthroughOptions =
      payload.maxFeePerGas > 0n || payload.maxPriorityFeePerGas > 0n
        ? [this.createEstimateLimitVariation(payload, estimatedFields, undefined, gasPrice.standard)]
        : []

    return [
      ...passthroughOptions,
      this.createEstimateLimitVariation(payload, estimatedFields, 'slow', gasPrice.slow),
      this.createEstimateLimitVariation(payload, estimatedFields, 'standard', gasPrice.standard),
      this.createEstimateLimitVariation(payload, estimatedFields, 'fast', gasPrice.fast),
    ]
  }

  private createEstimateLimitVariation(
    payload: Payload.Calls4337_07,
    estimatedFields: any,
    speed?: 'slow' | 'standard' | 'fast',
    feePerGasPair?: FeePerGasPair,
  ) {
    return {
      speed,
      payload: {
        ...payload,
        ...estimatedFields,
        maxFeePerGas: BigInt(feePerGasPair?.maxFeePerGas ?? payload.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(feePerGasPair?.maxPriorityFeePerGas ?? payload.maxPriorityFeePerGas),
      },
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
