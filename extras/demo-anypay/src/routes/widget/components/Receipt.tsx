import React from 'react'

interface ReceiptProps {
  onSendAnother: () => void
  txHash: string
}

export const Receipt: React.FC<ReceiptProps> = ({ onSendAnother, txHash }) => {
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
          href={`https://example.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 underline"
        >
          View on Explorer
        </a>
      </div>

      <button
        onClick={onSendAnother}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        Send Another Transaction
      </button>
    </div>
  )
}

export default Receipt
