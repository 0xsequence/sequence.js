import React from 'react'
import * as chains from 'viem/chains'

function getExplorerUrl(txHash: string, chainId: number) {
  const chainsArray = Object.values(chains) as Array<{ id: number; blockExplorers: { default: { url: string } } }>
  for (const chain of chainsArray) {
    if (chain.id === chainId) {
      return `${chain.blockExplorers?.default?.url}/tx/${txHash}`
    }
  }
  return ''
}

interface ReceiptProps {
  txHash?: string
  chainId?: number
  onSendAnother: () => void
  onClose: () => void
}

export const Receipt: React.FC<ReceiptProps> = ({ txHash, chainId, onSendAnother, onClose }) => {
  if (!txHash || !chainId) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Transaction Confirmed</h2>
      </div>

      <div className="text-center">
        <a
          href={getExplorerUrl(txHash, chainId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 underline"
        >
          View on Explorer
        </a>
      </div>

      <div className="space-y-3">
        <button
          onClick={onSendAnother}
          className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer text-white font-semibold py-3 px-4 rounded-[24px] transition-colors"
        >
          Start Another Transaction
        </button>
        <button
          onClick={onClose}
          className="w-full bg-gray-100 hover:bg-gray-200 cursor-pointer text-gray-600 hover:text-gray-900 font-semibold py-3 px-4 rounded-[24px] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default Receipt
