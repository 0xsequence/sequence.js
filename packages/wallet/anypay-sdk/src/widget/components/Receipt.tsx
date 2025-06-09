import React from 'react'
import { getExplorerUrl } from '../../anypay.js'

interface ReceiptProps {
  txHash?: string
  chainId?: number
  onSendAnother: () => void
  onClose: () => void
  theme?: 'light' | 'dark'
}

export const Receipt: React.FC<ReceiptProps> = ({ txHash, chainId, onSendAnother, onClose, theme = 'light' }) => {
  if (!txHash || !chainId) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div
          className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${
            theme === 'dark' ? 'bg-green-900/20' : 'bg-green-100'
          }`}
        >
          <svg
            className={`h-6 w-6 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className={`mt-4 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Transaction Confirmed
        </h2>
      </div>

      <div className="text-center">
        <a
          href={getExplorerUrl(txHash, chainId)}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline transition-colors ${
            theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-black hover:text-gray-900'
          }`}
        >
          View on Explorer
        </a>
      </div>

      <div className="space-y-3">
        <button
          onClick={onSendAnother}
          className={`w-full cursor-pointer font-semibold py-3 px-4 rounded-[24px] transition-colors ${
            theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          Start Another Transaction
        </button>
        <button
          onClick={onClose}
          className={`w-full cursor-pointer font-semibold py-3 px-4 rounded-[24px] transition-colors ${
            theme === 'dark'
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900'
          }`}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default Receipt
