import { Payload, Precondition } from '@0xsequence/wallet-primitives'
import { Hex, Provider, Secp256k1, TransactionEnvelopeEip1559, TransactionReceipt } from 'ox'
import { LocalRelayer } from './local.js'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from '../relayer.js'

export class PkRelayer implements Relayer {
  public readonly kind: 'relayer' = 'relayer'
  public readonly type = 'pk'
  public readonly id = 'pk'
  private readonly relayer: LocalRelayer

  constructor(
    privateKey: Hex.Hex,
    private readonly provider: Provider.Provider,
  ) {
    const relayerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey }))
    this.relayer = new LocalRelayer({
      sendTransaction: async (args, chainId) => {
        const providerChainId = BigInt(await this.provider.request({ method: 'eth_chainId' }))
        if (providerChainId !== chainId) {
          throw new Error('Provider chain id does not match relayer chain id')
        }

        // Estimate gas with a safety buffer
        const estimatedGas = BigInt(await this.provider.request({ method: 'eth_estimateGas', params: [args] }))
        const safeGasLimit = estimatedGas > 21000n ? (estimatedGas * 12n) / 10n : 50000n

        // Get base fee and priority fee
        const baseFee = BigInt(await this.provider.request({ method: 'eth_gasPrice' }))
        const priorityFee = 100000000n // 0.1 gwei priority fee
        const maxFeePerGas = baseFee + priorityFee

        // Check sender have enough balance
        const senderBalance = BigInt(
          await this.provider.request({ method: 'eth_getBalance', params: [relayerAddress, 'latest'] }),
        )
        if (senderBalance < maxFeePerGas * safeGasLimit) {
          console.log('Sender balance:', senderBalance.toString(), 'wei')
          throw new Error('Sender has insufficient balance to pay for gas')
        }
        const nonce = BigInt(
          await this.provider.request({
            method: 'eth_getTransactionCount',
            params: [relayerAddress, 'latest'],
          }),
        )

        // Build the relay envelope
        const relayEnvelope = TransactionEnvelopeEip1559.from({
          chainId: Number(chainId),
          type: 'eip1559',
          from: relayerAddress,
          to: args.to,
          data: args.data,
          gas: safeGasLimit,
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: priorityFee,
          nonce: nonce,
          value: 0n,
        })
        const relayerSignature = Secp256k1.sign({
          payload: TransactionEnvelopeEip1559.getSignPayload(relayEnvelope),
          privateKey: privateKey,
        })
        const signedRelayEnvelope = TransactionEnvelopeEip1559.from(relayEnvelope, {
          signature: relayerSignature,
        })
        const tx = await this.provider.request({
          method: 'eth_sendRawTransaction',
          params: [TransactionEnvelopeEip1559.serialize(signedRelayEnvelope)],
        })
        return tx
      },
      getBalance: async (address): Promise<bigint> => {
        const balanceHex = await this.provider.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        })
        return BigInt(balanceHex)
      },
      call: (args) => this.provider.request({ method: 'eth_call', params: [args, 'latest'] }),
      getTransactionReceipt: async (txHash: string, chainId: bigint) => {
        Hex.assert(txHash)

        const providerChainId = BigInt(await this.provider.request({ method: 'eth_chainId' }))
        if (providerChainId !== chainId) {
          throw new Error('Provider chain id does not match relayer chain id')
        }

        const rpcReceipt = await this.provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] })
        if (!rpcReceipt) {
          return 'unknown'
        }
        const receipt = TransactionReceipt.fromRpc(rpcReceipt)
        return receipt.status === 'success' ? 'success' : 'failed'
      },
    })
  }

  async isAvailable(_wallet: Address.Address, chainId: bigint): Promise<boolean> {
    const providerChainId = BigInt(await this.provider.request({ method: 'eth_chainId' }))
    return providerChainId === chainId
  }

  feeOptions(
    wallet: Address.Address,
    chainId: bigint,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    return this.relayer.feeOptions(wallet, chainId, calls)
  }

  async relay(to: Address.Address, data: Hex.Hex, chainId: bigint, _?: FeeQuote): Promise<{ opHash: Hex.Hex }> {
    const providerChainId = BigInt(await this.provider.request({ method: 'eth_chainId' }))
    if (providerChainId !== chainId) {
      throw new Error('Provider chain id does not match relayer chain id')
    }
    return this.relayer.relay(to, data, chainId)
  }

  status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus> {
    return this.relayer.status(opHash, chainId)
  }

  async checkPrecondition(precondition: Precondition.Precondition): Promise<boolean> {
    // TODO: Implement precondition check
    return true
  }
}
