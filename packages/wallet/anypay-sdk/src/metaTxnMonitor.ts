import { Relayer } from '@0xsequence/wallet-core'
import { Hex } from 'viem'
import { Query, useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

export type MetaTxn = {
  id: string
  chainId: string
  contract?: string | undefined
  input?: string | undefined
  walletAddress?: string | undefined
}

export type MetaTxnStatus = {
  [key: string]: Relayer.OperationStatus
}

const POLL_INTERVAL = 3_000 // 3 seconds

export const getMetaTxStatus = async (
  relayer: Relayer.Rpc.RpcRelayer,
  metaTxId: string,
  chainId: number,
): Promise<Relayer.OperationStatus> => {
  return relayer.status(metaTxId as `0x${string}`, BigInt(chainId))
}

export const useMetaTxnsMonitor = (
  metaTxns: MetaTxn[] | undefined,
  getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer,
) => {
  const results = useQueries({
    queries: (metaTxns || []).map((metaTxn) => {
      const opHashToPoll = metaTxn.id as Hex

      return {
        queryKey: ['metaTxnStatus', metaTxn.chainId, metaTxn.id],
        queryFn: async (): Promise<Relayer.OperationStatus> => {
          const relayer = getRelayer(parseInt(metaTxn.chainId))

          if (!opHashToPoll) {
            return {
              status: 'failed',
              reason: 'Missing operation hash for monitoring.',
            } as Relayer.OperationFailedStatus
          }

          if (!relayer) {
            return {
              status: 'failed',
              reason: `Relayer not available for chain ${metaTxn.chainId}.`,
            } as Relayer.OperationFailedStatus
          }

          const opStatus = await relayer.status(opHashToPoll, BigInt(metaTxn.chainId))

          let newStatusEntry: Relayer.OperationStatus

          if (opStatus.status === 'confirmed') {
            newStatusEntry = {
              status: 'confirmed',
              transactionHash: opStatus.transactionHash,
              data: opStatus.data,
            } as Relayer.OperationConfirmedStatus
          } else if (opStatus.status === 'failed') {
            newStatusEntry = {
              status: 'failed',
              reason: opStatus.reason,
              data: opStatus.data,
            } as Relayer.OperationFailedStatus
          } else if (opStatus.status === 'pending') {
            newStatusEntry = { status: 'pending' } as Relayer.OperationPendingStatus
          } else if (opStatus.status === 'unknown') {
            newStatusEntry = { status: 'unknown' } as Relayer.OperationUnknownStatus
          } else {
            const originalStatus = (opStatus as any).status as string
            console.warn(`⚠️ Unexpected relayer status "${originalStatus}" for ${opHashToPoll}:`, opStatus)
            newStatusEntry = { status: 'unknown' } as Relayer.OperationUnknownStatus
          }
          return newStatusEntry
        },
        refetchInterval: (
          query: Query<Relayer.OperationStatus, Error, Relayer.OperationStatus, ReadonlyArray<unknown>>,
        ) => {
          const data = query.state.data
          if (!data) return POLL_INTERVAL
          if (data.status === 'confirmed') return false
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

  const statuses: MetaTxnStatus = useMemo(() => {
    const newStatuses: MetaTxnStatus = {}
    ;(metaTxns || []).forEach((metaTxn, index) => {
      const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
      const queryResult = results[index]

      if (queryResult) {
        if (queryResult.isLoading && queryResult.fetchStatus !== 'idle' && !queryResult.data) {
          newStatuses[operationKey] = { status: 'pending' } as Relayer.OperationPendingStatus
        } else if (queryResult.isError) {
          newStatuses[operationKey] = {
            status: 'failed',
            reason: (queryResult.error as Error)?.message || 'An unknown error occurred',
          } as Relayer.OperationFailedStatus
        } else if (queryResult.data) {
          newStatuses[operationKey] = queryResult.data as Relayer.OperationStatus
        } else {
          newStatuses[operationKey] = { status: 'unknown' } as Relayer.OperationUnknownStatus
        }
      } else {
        newStatuses[operationKey] = {
          status: 'failed',
          reason: 'Query result unexpectedly missing',
        } as Relayer.OperationFailedStatus
      }
    })
    return newStatuses
  }, [metaTxns, results])

  return statuses
}
