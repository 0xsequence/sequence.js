import React, { useState } from 'react'

interface Token {
  id: number
  name: string
  symbol: string
  balance: string
  imageUrl: string
}

interface TokenListProps {
  onContinue: (selectedToken: Token) => void
}

const dummyTokens: Token[] = [
  {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    balance: '1.234',
    imageUrl: '/ethereum-eth-logo.svg',
  },
  {
    id: 2,
    name: 'USD Coin',
    symbol: 'USDC',
    balance: '100.00',
    imageUrl: '/usd-coin-usdc-logo.svg',
  },
  {
    id: 3,
    name: 'Tether',
    symbol: 'USDT',
    balance: '50.00',
    imageUrl: '/tether-usdt-logo.svg',
  },
  {
    id: 4,
    name: 'Dai',
    symbol: 'DAI',
    balance: '75.50',
    imageUrl: '/logos/multi-collateral-dai-dai-logo.svg',
  },
]

export const TokenList: React.FC<TokenListProps> = ({ onContinue }) => {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select Token</h2>
      <div className="divide-y divide-gray-200">
        {dummyTokens.map((token) => (
          <div
            key={token.id}
            onClick={() => setSelectedToken(token)}
            className={`py-4 px-4 -mx-4 flex items-center space-x-4 cursor-pointer transition-colors ${
              selectedToken?.id === token.id ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <img src={token.imageUrl} alt={token.name} className="w-8 h-8" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">{token.name}</h3>
              <p className="text-sm text-gray-500">{token.symbol}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-medium text-gray-900">{token.balance}</p>
              <p className="text-sm text-gray-500">{token.symbol}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => selectedToken && onContinue(selectedToken)}
        disabled={!selectedToken}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        Continue
      </button>
    </div>
  )
}

export default TokenList
