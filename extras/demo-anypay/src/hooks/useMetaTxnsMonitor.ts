import { useState, useEffect, useRef } from 'react'
import { Relayer } from '@0xsequence/wallet-core'
import { Hex } from 'viem'
import { ETHTxnStatus, MetaTxnReceipt } from '../gen/relayer.gen'

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

type LastChecked = {
  [key: string]: number
}

const POLL_INTERVAL = 10_000 // 10 seconds

export const useMetaTxnsMonitor = (
  metaTxns: MetaTxn[] | undefined,
  getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer,
) => {
  const [statuses, setStatuses] = useState<MetaTxnStatus>({})
  const lastCheckedRef = useRef<LastChecked>({})
  const timeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({})

  useEffect(() => {
    if (!metaTxns || metaTxns.length === 0) {
      setStatuses({})
      return
    }

    let isSubscribed = true

    const monitorStatus = async (metaTxn: MetaTxn) => {
      const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
      const opHashToPoll = metaTxn.id as Hex
      const relayer = getRelayer(parseInt(metaTxn.chainId))
      console.log('opHashToPoll', opHashToPoll, 'for chainId', metaTxn.chainId)

      if (!opHashToPoll) {
        if (isSubscribed) {
          setStatuses((prev) => ({
            ...prev,
            [operationKey]: { status: 'failed', reason: 'Missing operation hash for monitoring.' },
          }))
        }
        return
      }

      if (!relayer) {
        if (isSubscribed) {
          setStatuses((prev) => ({
            ...prev,
            [operationKey]: { status: 'failed', reason: `Relayer not available for chain ${metaTxn.chainId}.` },
          }))
        }
        return
      }

      const now = Date.now()
      const lastChecked = lastCheckedRef.current[operationKey] || 0
      const timeSinceLastCheck = now - lastChecked

      // Skip if we checked too recently
      if (timeSinceLastCheck < POLL_INTERVAL) {
        const timeToNextCheck = POLL_INTERVAL - timeSinceLastCheck
        timeoutsRef.current[operationKey] = setTimeout(() => monitorStatus(metaTxn), timeToNextCheck)
        return
      }

      try {
        lastCheckedRef.current[operationKey] = now
        const res = await relayer.receipt(opHashToPoll, BigInt(metaTxn.chainId))

        if (!isSubscribed) return

        const apiStatus = res.receipt?.status as ETHTxnStatus
        let newStatusEntry: MetaTxnStatusValue

        switch (apiStatus) {
          case ETHTxnStatus.QUEUED:
          case ETHTxnStatus.PENDING_PRECONDITION:
          case ETHTxnStatus.SENT:
            newStatusEntry = { status: 'pending', receipt: res.receipt }
            break
          case ETHTxnStatus.SUCCEEDED:
            newStatusEntry = { status: 'confirmed', transactionHash: res.receipt.txnHash as Hex, receipt: res.receipt }
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

        if (isSubscribed) {
          setStatuses((prev) => ({
            ...prev,
            [operationKey]: newStatusEntry,
          }))

          if (newStatusEntry.status === 'pending' || newStatusEntry.status === 'unknown') {
            timeoutsRef.current[operationKey] = setTimeout(() => monitorStatus(metaTxn), POLL_INTERVAL)
          }
        }
      } catch (error: any) {
        if (!isSubscribed) return
        setStatuses((prev) => ({
          ...prev,
          [operationKey]: {
            status: 'failed',
            reason: error.message,
          },
        }))
      }
    }

    // Start monitoring all meta transactions
    metaTxns.forEach((metaTxn) => {
      monitorStatus(metaTxn)
    })

    return () => {
      isSubscribed = false
      // Clear all timeouts
      Object.values(timeoutsRef.current).forEach((timeout) => {
        clearTimeout(timeout)
      })
      timeoutsRef.current = {}
    }
  }, [metaTxns, getRelayer])

  return statuses
}
