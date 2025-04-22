import { useState, useEffect } from 'react'
import { Relayer } from '@0xsequence/wallet-core'
import { Hex } from 'viem'

type OperationStatus = {
  status: 'pending' | 'success' | 'failed'
  txHash?: string
  error?: string
}

export const useMetaTxnMonitor = (
  opHash: Hex | undefined,
  chainId: string,
  relayer: Relayer.Rpc.RpcRelayer | undefined,
) => {
  const [status, setStatus] = useState<OperationStatus>({ status: 'pending' })

  useEffect(() => {
    // Reset status when opHash or relayer changes
    if (!opHash || !relayer) {
      setStatus({ status: 'pending' })
      return
    }

    let isSubscribed = true
    let timeoutId: NodeJS.Timeout | undefined

    const monitorStatus = async () => {
      try {
        const currentStatus = await relayer.status(opHash, BigInt(chainId))

        if (!isSubscribed) return

        const newStatus: OperationStatus = {
          status:
            currentStatus.status === 'confirmed' ? 'success' : currentStatus.status === 'failed' ? 'failed' : 'pending',
          txHash: currentStatus.status === 'confirmed' ? currentStatus.transactionHash : undefined,
          error: currentStatus.status === 'failed' ? currentStatus.reason : undefined,
        }

        setStatus(newStatus)

        // Continue monitoring if still pending
        if (currentStatus.status === 'pending' && isSubscribed) {
          timeoutId = setTimeout(monitorStatus, 5000)
        }
      } catch (error: any) {
        if (!isSubscribed) return
        setStatus({
          status: 'failed',
          error: error.message,
        })
      }
    }

    monitorStatus()

    return () => {
      isSubscribed = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [opHash, chainId, relayer])

  return status
}
