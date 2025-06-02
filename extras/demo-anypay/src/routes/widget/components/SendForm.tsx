import React, { useState } from 'react'

interface SendFormProps {
  onSend: (amount: string, recipient: string) => void
  selectedToken: {
    symbol: string
    balance: string
  }
}

export const SendForm: React.FC<SendFormProps> = ({ onSend, selectedToken }) => {
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('send')
    onSend(amount, recipient)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Send {selectedToken.symbol}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <input
              type="number"
              name="amount"
              id="amount"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-4 pr-12 sm:text-sm border-gray-300 rounded-md"
              placeholder="0.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">{selectedToken.symbol}</span>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Balance: {selectedToken.balance} {selectedToken.symbol}
          </p>
        </div>

        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
            Recipient Address
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="recipient"
              id="recipient"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="0x..."
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default SendForm
