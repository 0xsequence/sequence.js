import React, { useState, useRef, useEffect } from 'react'
import { NetworkImage } from '@0xsequence/design-system'
import * as chains from 'viem/chains'
import { createWalletClient, custom, formatUnits, parseUnits, type Account } from 'viem'
import { ChevronDown } from 'lucide-react'
import { prepareSend, getChainConfig } from '@anypay/sdk'
import { zeroAddress } from 'viem'

interface Token {
  id: number
  name: string
  symbol: string
  balance: string
  imageUrl: string
  chainId: number
  contractAddress: string
  contractInfo?: {
    decimals: number
    symbol: string
    name: string
  }
}

interface SendFormProps {
  selectedToken: Token
  onSend: (amount: string, recipient: string) => void
  account: Account
}

// Available chains
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum', icon: chains.mainnet.id },
  { id: 8453, name: 'Base', icon: chains.base.id },
  { id: 10, name: 'Optimism', icon: chains.optimism.id },
  { id: 42161, name: 'Arbitrum', icon: chains.arbitrum.id },
]

// Available tokens
const SUPPORTED_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', icon: '⟠' },
  { symbol: 'USDC', name: 'USD Coin', icon: '$' },
]

// Helper to get chain info
const getChainInfo = (chainId: number) => {
  return Object.values(chains).find((chain) => chain.id === chainId) || null
}

// Helper to format balance
const formatBalance = (balance: string, decimals: number = 18) => {
  try {
    const formatted = formatUnits(BigInt(balance), decimals)
    const num = parseFloat(formatted)
    if (num === 0) return '0'
    if (num < 0.0001) return num.toExponential(2)
    if (num < 1) return num.toFixed(6)
    if (num < 1000) return num.toFixed(4)
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  } catch (e) {
    console.error('Error formatting balance:', e)
    return balance
  }
}

export const SendForm: React.FC<SendFormProps> = ({ selectedToken, onSend, account }) => {
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [selectedChain, setSelectedChain] = useState(
    () => SUPPORTED_CHAINS.find((chain) => chain.id === selectedToken.chainId) || SUPPORTED_CHAINS[0],
  )
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false)
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
  const [selectedDestToken, setSelectedDestToken] = useState(SUPPORTED_TOKENS[0])
  const chainDropdownRef = useRef<HTMLDivElement>(null)
  const tokenDropdownRef = useRef<HTMLDivElement>(null)
  const chainInfo = getChainInfo(selectedToken.chainId)

  const formattedBalance = formatBalance(selectedToken.balance, selectedToken.contractInfo?.decimals)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false)
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Convert amount to proper decimal format
      const decimals = selectedToken.contractInfo?.decimals || 18
      const parsedAmount = parseUnits(amount, decimals).toString()

      console.log('account', account)

      const client = createWalletClient({
        account,
        chain: getChainConfig(selectedChain.id),
        transport: custom(window.ethereum),
      })

      const options = {
        account,
        originTokenAddress: selectedToken.contractAddress,
        originChainId: selectedToken.chainId,
        originTokenAmount: selectedToken.balance,
        destinationChainId: selectedChain.id,
        recipient,
        destinationTokenAddress: selectedDestToken.symbol === 'ETH' ? zeroAddress : selectedToken.contractAddress,
        destinationTokenAmount: parsedAmount,
        sequenceApiKey: import.meta.env.VITE_SEQUENCE_API_KEY as string,
        fee: selectedToken.symbol === 'ETH' ? parseUnits('0.0001', 18).toString() : parseUnits('0.02', 6).toString(),
        client,
      }

      const { intentAddress, send } = await prepareSend(options)
      console.log('Intent address:', intentAddress.toString())

      await send()
      onSend(amount, recipient)
    } catch (error) {
      console.error('Error in prepareSend:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-2xl font-medium text-gray-600">{selectedToken.symbol[0]}</span>
          </div>
          <div className="absolute -bottom-1 -right-1">
            <NetworkImage chainId={selectedToken.chainId} size="sm" className="w-6 h-6" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">From: {selectedToken.name}</h3>
          <p className="text-sm text-gray-500">
            on {chainInfo?.name || 'Unknown Chain'} • Balance: {formattedBalance} {selectedToken.symbol}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Chain Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Destination Chain</label>
          <div className="relative" ref={chainDropdownRef}>
            <button
              type="button"
              onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
              className="w-full flex items-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <NetworkImage chainId={selectedChain.icon} size="sm" className="w-5 h-5" />
              <span className="ml-2 flex-1 text-left text-gray-900">{selectedChain.name}</span>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform ${isChainDropdownOpen ? 'transform rotate-180' : ''}`}
              />
            </button>

            {isChainDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {SUPPORTED_CHAINS.map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => {
                      setSelectedChain(chain)
                      setIsChainDropdownOpen(false)
                    }}
                    className={`w-full flex items-center px-4 py-3 hover:bg-gray-50 ${
                      selectedChain.id === chain.id ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                    }`}
                  >
                    <NetworkImage chainId={chain.icon} size="sm" className="w-5 h-5" />
                    <span className="ml-2">{chain.name}</span>
                    {selectedChain.id === chain.id && <span className="ml-auto text-blue-600">•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Token Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Receive Token</label>
          <div className="relative" ref={tokenDropdownRef}>
            <button
              type="button"
              onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
              className="w-full flex items-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                {selectedDestToken.icon}
              </div>
              <span className="ml-2 flex-1 text-left text-gray-900">{selectedDestToken.name}</span>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform ${isTokenDropdownOpen ? 'transform rotate-180' : ''}`}
              />
            </button>

            {isTokenDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {SUPPORTED_TOKENS.map((token) => (
                  <button
                    key={token.symbol}
                    type="button"
                    onClick={() => {
                      setSelectedDestToken(token)
                      setIsTokenDropdownOpen(false)
                    }}
                    className={`w-full flex items-center px-4 py-3 hover:bg-gray-50 ${
                      selectedDestToken.symbol === token.symbol ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                      {token.icon}
                    </div>
                    <span className="ml-2">{token.name}</span>
                    {selectedDestToken.symbol === token.symbol && <span className="ml-auto text-blue-600">•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount to Receive
            </label>
            <span className="text-sm text-gray-500">Using {selectedToken.symbol}</span>
          </div>
          <div className="relative rounded-lg">
            <input
              id="amount"
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="block w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 text-lg"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <span className="text-gray-500">{selectedDestToken.symbol}</span>
            </div>
          </div>
        </div>

        {/* Recipient Input */}
        <div className="space-y-2">
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
            Recipient Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 font-mono text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={!amount || !recipient}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Receive {amount ? `${amount} ${selectedDestToken.symbol}` : ''}
        </button>
      </form>
    </div>
  )
}

const styles = `
  select {
    appearance: none;
    border: 1px solid #e5e7eb;
    outline: none;
    font-size: 1rem;
    width: 100%;
    background-color: #fff;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    padding-right: 2rem;
    
    cursor: pointer;
    transition: all 0.2s;
  }

  select:hover {
    border-color: #d1d5db;
  }

  select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  select option {
    padding: 0.75rem 1rem;
    min-height: 3rem;
    display: flex;
    align-items: center;
    padding-left: 2.75rem;
    position: relative;
    cursor: pointer;
  }

  select option:hover {
    background-color: #f3f4f6;
  }

  select option:checked {
    background-color: #eff6ff;
    color: #1d4ed8;
  }
`

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style')
  styleTag.textContent = styles
  document.head.appendChild(styleTag)
}

export default SendForm
