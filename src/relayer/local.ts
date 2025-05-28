import { Constants, Payload } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Bytes, Hex, TransactionReceipt } from 'ox'
import { FeeOption, FeeQuote, OperationStatus, Relayer } from './relayer.js'

type GenericProviderTransactionReceipt = 'success' | 'failed' | 'unknown'

export interface GenericProvider {
  sendTransaction(args: { to: string; data: string }, chainId: bigint): Promise<string>
  getTransactionReceipt(txHash: string, chainId: bigint): Promise<GenericProviderTransactionReceipt>
}

export class LocalRelayer implements Relayer {
  public readonly id = 'local'

  constructor(public readonly provider: GenericProvider) {}

  static createFromWindow(window: Window): LocalRelayer | undefined {
    const eth = (window as any).ethereum
    if (!eth) {
      console.warn('Window.ethereum not found, skipping local relayer')
      return undefined
    }

    const trySwitchChain = async (chainId: bigint) => {
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [
            {
              chainId: `0x${chainId.toString(16)}`,
            },
          ],
        })
      } catch (error) {
        // Log and continue
        console.error('Error switching chain', error)
      }
    }

    return new LocalRelayer({
      sendTransaction: async (args, chainId) => {
        const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' })
        const from = accounts[0]
        if (!from) {
          console.warn('No account selected, skipping local relayer')
          return undefined
        }

        await trySwitchChain(chainId)

        const tx = await eth.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from,
              to: args.to,
              data: args.data,
            },
          ],
        })
        return tx
      },
      getTransactionReceipt: async (txHash, chainId) => {
        await trySwitchChain(chainId)

        const rpcReceipt = await eth.request({ method: 'eth_getTransactionReceipt', params: [txHash] })
        if (rpcReceipt) {
          const receipt = TransactionReceipt.fromRpc(rpcReceipt)
          if (receipt?.status === 'success') {
            return 'success'
          } else if (receipt?.status === 'reverted') {
            return 'failed'
          }
        }
        return 'unknown'
      },
    })
  }

  feeOptions(
    wallet: Address.Address,
    chainId: bigint,
    calls: Payload.Call[],
  ): Promise<{ options: FeeOption[]; quote?: FeeQuote }> {
    return Promise.resolve({ options: [] })
  }

  private decodeCalls(data: Hex.Hex): Payload.Calls {
    const executeSelector = AbiFunction.getSelector(Constants.EXECUTE)

    let packedPayload
    if (data.startsWith(executeSelector)) {
      const decode = AbiFunction.decodeData(Constants.EXECUTE, data)
      packedPayload = decode[0]
    } else {
      packedPayload = data
    }

    return Payload.decode(Bytes.fromHex(packedPayload))
  }

  async relay(to: Address.Address, data: Hex.Hex, chainId: bigint, _?: FeeQuote): Promise<{ opHash: Hex.Hex }> {
    const txHash = await this.provider.sendTransaction(
      {
        to,
        data,
      },
      chainId,
    )
    Hex.assert(txHash)

    return { opHash: txHash }
  }

  async status(opHash: Hex.Hex, chainId: bigint): Promise<OperationStatus> {
    const receipt = await this.provider.getTransactionReceipt(opHash, chainId)
    if (receipt === 'unknown') {
      // Could be pending but we don't know
      return { status: 'unknown' }
    }
    return receipt === 'success'
      ? { status: 'confirmed', transactionHash: opHash }
      : { status: 'failed', reason: 'failed' }
  }
}
