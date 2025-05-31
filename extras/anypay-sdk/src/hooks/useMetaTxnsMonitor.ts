import { useState, useEffect, useRef } from 'react'
import { Relayer } from '@0xsequence/wallet-core'
import { Hex } from 'viem'

export type MetaTxn = {
  id: string
  chainId: string
  contract?: string | undefined
  input?: string | undefined
  walletAddress?: string | undefined
}

type MetaTxnStatus = {
  [key: string]: Relayer.OperationStatus
}

type LastChecked = {
  [key: string]: number
}

const POLL_INTERVAL = 10_000 // 10 seconds

export async function getMetaTxStatus(relayer: Relayer.Rpc.RpcRelayer, metaTxId: string, chainId: number) {
  return relayer.status(metaTxId as `0x${string}`, BigInt(chainId))
}

export const useMetaTxnsMonitor = (
  metaTxns: MetaTxn[] | undefined,
  operationHashes: { [key: string]: Hex },
  getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer,
) => {
  const [statuses, setStatuses] = useState<MetaTxnStatus>({})
  const lastCheckedRef = useRef<LastChecked>({})
  const timeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({})

  useEffect(() => {
    if (!metaTxns || metaTxns.length === 0) {
      // Only clear statuses if we actually have some statuses to clear
      setStatuses((prev) => (Object.keys(prev).length > 0 ? {} : prev))
      return
    }

    let isSubscribed = true

    const monitorStatus = async (metaTxn: MetaTxn) => {
      const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
      const opHashToPoll = metaTxn.id as Hex
      const relayer = getRelayer(parseInt(metaTxn.chainId))

      console.log('opHashToPoll', opHashToPoll)

      if (!opHashToPoll || !relayer) {
        if (isSubscribed) {
          setStatuses((prev) => ({
            ...prev,
            [operationKey]: { status: 'pending' },
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
        const status = await getMetaTxStatus(relayer, opHashToPoll, parseInt(metaTxn.chainId))
        if (!isSubscribed) return

        setStatuses((prev) => ({
          ...prev,
          [operationKey]: status,
        }))

        // Continue monitoring if still pending
        if (status.status === 'pending' && isSubscribed) {
          timeoutsRef.current[operationKey] = setTimeout(() => monitorStatus(metaTxn), POLL_INTERVAL)
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
