import { Relayer } from '@0xsequence/wallet-core'
import { Hex } from 'viem'
import { ETHTxnStatus, MetaTxnReceipt } from './gen/relayer.gen.js'
import { Query, useQueries } from '@tanstack/react-query'

export type MetaTxn = {
  id: string
  chainId: string
  contract?: string | undefined
  input?: string | undefined
  walletAddress?: string | undefined
}

export type MetaTxnStatusValue = {
  status: string
  reason?: string
  receipt?: MetaTxnReceipt
  transactionHash?: Hex
}

export type MetaTxnStatus = {
  [key: string]: MetaTxnStatusValue
}

const POLL_INTERVAL = 3_000 // 3 seconds

export async function getMetaTxStatus(
  relayer: Relayer.Rpc.RpcRelayer,
  metaTxId: string,
  chainId: number,
): Promise<Relayer.OperationStatus> {
  return relayer.status(metaTxId as `0x${string}`, BigInt(chainId))
}

export function useMetaTxnsMonitor(
  metaTxns: MetaTxn[] | undefined,
  getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer,
): MetaTxnStatus {
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

          const res = await (relayer as any).receipt(opHashToPoll, BigInt(metaTxn.chainId)) // TODO: add proper type

          console.log(`🔍 Meta transaction debug for ${opHashToPoll}:`, {
            opHash: opHashToPoll,
            chainId: metaTxn.chainId,
            hasResponse: !!res,
            hasReceipt: !!res?.receipt,
            receiptStatus: res?.receipt?.status,
            statusType: typeof res?.receipt?.status,
            fullResponse: res,
          })

          if (!res || !res.receipt) {
            console.warn(`❌ No receipt for ${opHashToPoll}:`, res)
            return { status: 'unknown', reason: 'No receipt available' }
          }

          const apiStatus = res.receipt.status as ETHTxnStatus

          if (!apiStatus) {
            console.warn(`❌ No status in receipt for ${opHashToPoll}:`, res.receipt)
            return { status: 'unknown', reason: 'Receipt status is null or undefined', receipt: res.receipt }
          }

          console.log(`📊 Processing status ${apiStatus} for ${opHashToPoll}`)
          let newStatusEntry: MetaTxnStatusValue

          switch (apiStatus) {
            case ETHTxnStatus.QUEUED:
            case ETHTxnStatus.PENDING_PRECONDITION:
            case ETHTxnStatus.SENT:
              newStatusEntry = { status: 'pending', receipt: res.receipt }
              break
            case ETHTxnStatus.SUCCEEDED:
              console.log(`✅ Success for ${opHashToPoll}:`, res.receipt)
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
              console.warn(`❓ Unknown status for ${opHashToPoll}:`, res.receipt)
              newStatusEntry = { status: 'unknown', receipt: res.receipt }
              break
            default:
              console.warn(`⚠️ Unexpected status "${apiStatus}" for ${opHashToPoll}:`, res.receipt)
              newStatusEntry = { status: 'unknown', receipt: res.receipt, reason: `Unexpected status: ${apiStatus}` }
              break
          }

          console.log(`🎯 Final status for ${opHashToPoll}:`, newStatusEntry.status)
          return newStatusEntry
        },
        refetchInterval: (query: Query<MetaTxnStatusValue, Error, MetaTxnStatusValue, readonly unknown[]>) => {
          const data = query.state.data

          if (data?.status === 'confirmed' || data?.status === 'failed') {
            return false
          }

          if (data?.status === 'pending') {
            return POLL_INTERVAL
          }

          if (data?.status === 'unknown') {
            return POLL_INTERVAL
          }

          return POLL_INTERVAL
        },
        enabled: !!metaTxn && !!metaTxn.id && !!metaTxn.chainId,
        retry: (failureCount: number, error: Error) => {
          if (failureCount >= 30) {
            console.error(`❌ Giving up on transaction ${opHashToPoll} after 3 failed API attempts:`, error)
            return false
          }
          return true
        },
      }
    }),
  })

  const statuses: MetaTxnStatus = {}
  ;(metaTxns || []).forEach((metaTxn, index) => {
    const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
    const queryResult = results[index]!

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
