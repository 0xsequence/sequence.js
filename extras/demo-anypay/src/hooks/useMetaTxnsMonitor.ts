import { Relayer } from '@0xsequence/wallet-core'
import { Hex } from 'viem'
import { ETHTxnStatus, MetaTxnReceipt } from '../gen/relayer.gen'
import { Query, useQueries } from '@tanstack/react-query'

export type MetaTxn = {
  id: string
  chainId: string
  contract?: string | undefined
  input?: string | undefined
  walletAddress?: string | undefined
}

type MetaTxnStatusValue = {
  status: string
  reason?: string
  receipt?: MetaTxnReceipt
  transactionHash?: Hex
}

type MetaTxnStatus = {
  [key: string]: MetaTxnStatusValue
}

const POLL_INTERVAL = 3_000 // 3 seconds

export const useMetaTxnsMonitor = (
  metaTxns: MetaTxn[] | undefined,
  getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer,
) => {
  const results = useQueries({
    queries: (metaTxns || []).map((metaTxn) => {
      // const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
      const opHashToPoll = metaTxn.id as Hex

      return {
        queryKey: ['metaTxnStatus', metaTxn.chainId, metaTxn.id],
        queryFn: async () => {
          const relayer = getRelayer(parseInt(metaTxn.chainId))

          if (!opHashToPoll) {
            return { status: 'failed', reason: 'Missing operation hash for monitoring.' }
          }

          if (!relayer) {
            return { status: 'failed', reason: `Relayer not available for chain ${metaTxn.chainId}.` }
          }

          const res = await relayer.receipt(opHashToPoll, BigInt(metaTxn.chainId))
          const apiStatus = res.receipt?.status as ETHTxnStatus
          let newStatusEntry: MetaTxnStatusValue

          switch (apiStatus) {
            case ETHTxnStatus.QUEUED:
            case ETHTxnStatus.PENDING_PRECONDITION:
            case ETHTxnStatus.SENT:
              newStatusEntry = { status: 'pending', receipt: res.receipt }
              break
            case ETHTxnStatus.SUCCEEDED:
              newStatusEntry = {
                status: 'confirmed',
                transactionHash: res.receipt.txnHash as Hex,
                receipt: res.receipt,
              }
              break
            case ETHTxnStatus.FAILED:
            case ETHTxnStatus.PARTIALLY_FAILED:
              newStatusEntry = {
                status: 'failed',
                reason: res.receipt.revertReason || 'Relayer reported failure',
                receipt: res.receipt,
              }
              break
            case ETHTxnStatus.DROPPED:
              newStatusEntry = { status: 'failed', reason: 'Transaction dropped', receipt: res.receipt }
              break
            case ETHTxnStatus.UNKNOWN:
            default:
              newStatusEntry = { status: 'unknown', receipt: res.receipt }
              break
          }
          return newStatusEntry
        },
        refetchInterval: (
          query: Query<MetaTxnStatusValue, Error, MetaTxnStatusValue, readonly (string | number)[]>,
        ) => {
          const data = query.state.data
          if (data?.status === 'pending' || data?.status === 'unknown') {
            return POLL_INTERVAL
          }
          return false // Disable polling if status is terminal
        },
        enabled: !!metaTxn && !!metaTxn.id && !!metaTxn.chainId,
        // Keep previous data while refetching to avoid UI flickering if needed
        // keepPreviousData: true,
      }
    }),
  })

  const statuses: MetaTxnStatus = {}
  ;(metaTxns || []).forEach((metaTxn, index) => {
    const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
    const queryResult = results[index]

    if (queryResult.isLoading && queryResult.fetchStatus !== 'idle' && !queryResult.data) {
      statuses[operationKey] = { status: 'loading' }
    } else if (queryResult.isError) {
      statuses[operationKey] = {
        status: 'failed',
        reason: (queryResult.error as Error)?.message || 'An unknown error occurred',
      }
    } else if (queryResult.data) {
      statuses[operationKey] = queryResult.data as MetaTxnStatusValue
    } else {
      // Default or initial state before first fetch attempt if not loading and no data/error
      statuses[operationKey] = { status: 'unknown' }
    }
  })

  return statuses
}
