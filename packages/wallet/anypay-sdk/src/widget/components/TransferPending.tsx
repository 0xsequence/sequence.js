import React, { useEffect } from 'react'

interface TransferPendingProps {
  onComplete: () => void
}

export const TransferPending: React.FC<TransferPendingProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="space-y-6 flex flex-col items-center justify-center py-8">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
      <h2 className="text-2xl font-bold text-gray-900">Transfer Pending</h2>
      <p className="text-gray-500">Waiting for confirmation...</p>
    </div>
  )
}

export default TransferPending
