import React, { useState, useRef, useEffect, useMemo } from 'react'

import { NetworkImage, TokenImage } from '@0xsequence/design-system'
import * as chains from 'viem/chains'
import { createWalletClient, custom, formatUnits, parseUnits, type Account } from 'viem'
import { ChevronDown, Loader2 } from 'lucide-react'
import { prepareSend, getChainConfig } from '../../anypay.js'
import { getAPIClient } from '../../apiClient.js'
import { getRelayer } from '../../relayer.js'
import { zeroAddress } from 'viem'
import { useEnsAddress } from 'wagmi'
import { mainnet } from 'viem/chains'

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
  onBack: () => void
  onConfirm: () => void
  onComplete: () => void
  account: Account
  sequenceApiKey: string
  apiUrl: string
  env?: 'local' | 'cors-anywhere' | 'dev' | 'prod'
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
  {
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: `https://assets.sequence.info/images/tokens/small/1/0x0000000000000000000000000000000000000000.webp`,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    imageUrl: `https://assets.sequence.info/images/tokens/small/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.webp`,
  },
]

// Helper to get chain info
const getChainInfo = (chainId: number) => {
  // TODO: Add proper type
  return Object.values(chains).find((chain: any) => chain.id === chainId) || null
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

function getDestTokenAddress(chainId: number, tokenSymbol: string) {
  if (tokenSymbol === 'ETH') {
    return zeroAddress
  }

  if (chainId === 10) {
    if (tokenSymbol === 'USDC') {
      return '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
    }
  }

  if (chainId === 42161) {
    if (tokenSymbol === 'USDC') {
      return '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    }
  }

  if (chainId === 8453) {
    if (tokenSymbol === 'USDC') {
      return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    }
  }

  throw new Error(`Unsupported token symbol: ${tokenSymbol} for chainId: ${chainId}`)
}

export const SendForm: React.FC<SendFormProps> = ({
  selectedToken,
  onSend,
  onBack,
  onConfirm,
  onComplete,
  account,
  sequenceApiKey,
  apiUrl,
  env,
}) => {
  const [amount, setAmount] = useState('')
  const [recipientInput, setRecipientInput] = useState('')
  const [recipient, setRecipient] = useState('')
  const {
    data: ensAddress,
    isLoading,
    error: ensError,
  } = useEnsAddress({
    name: recipientInput.endsWith('.eth') ? recipientInput : undefined,
    chainId: mainnet.id,
    query: {
      enabled: !!recipientInput && recipientInput.endsWith('.eth'),
    },
  })

  useEffect(() => {
    if (ensAddress) {
      setRecipient(ensAddress)
    } else {
      setRecipient(recipientInput)
    }
  }, [ensAddress, recipientInput])

  const handleRecipientInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipientInput(e.target.value.trim())
  }

  const [selectedChain, setSelectedChain] = useState(
    () => (SUPPORTED_CHAINS.find((chain) => chain.id === selectedToken.chainId) || SUPPORTED_CHAINS[0])!,
  )
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false)
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
  const [selectedDestToken, setSelectedDestToken] = useState(SUPPORTED_TOKENS[0]!)
  const chainDropdownRef = useRef<HTMLDivElement>(null)
  const tokenDropdownRef = useRef<HTMLDivElement>(null)
  const chainInfo = getChainInfo(selectedToken.chainId) as any // TODO: Add proper type
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      setIsSubmitting(true)
      const decimals = selectedDestToken.symbol === 'ETH' ? 18 : 6
      const parsedAmount = parseUnits(amount, decimals).toString()

      const client = createWalletClient({
        account,
        chain: getChainConfig(selectedToken.chainId),
        transport: custom((window as any).ethereum),
      })

      console.log('selectedDestToken.symbol', selectedDestToken)

      const apiClient = getAPIClient({ apiUrl, projectAccessKey: sequenceApiKey })
      const originRelayer = getRelayer({ env, useV3Relayers: true }, selectedToken.chainId)
      const destinationRelayer = getRelayer({ env, useV3Relayers: true }, selectedChain.id)

      const options = {
        account,
        originTokenAddress: selectedToken.contractAddress,
        originChainId: selectedToken.chainId,
        originTokenAmount: selectedToken.balance,
        destinationChainId: selectedChain.id,
        recipient,
        destinationTokenAddress:
          selectedDestToken.symbol === 'ETH'
            ? zeroAddress
            : getDestTokenAddress(selectedChain.id, selectedDestToken.symbol),
        destinationTokenAmount: parsedAmount,
        sequenceApiKey,
        fee: selectedToken.symbol === 'ETH' ? parseUnits('0.0001', 18).toString() : parseUnits('0.02', 6).toString(), // TOOD: fees
        client,
        apiClient,
        originRelayer,
        destinationRelayer,
        dryMode: false, // Set to true to skip the metamask transaction, for testing purposes
      }

      console.log('options', options)

      const { intentAddress, send } = await prepareSend(options)
      console.log('Intent address:', intentAddress.toString())

      // Start the send process
      onSend(amount, recipient)

      // Wait for send to complete
      send().then(() => {
        // Move to receipt screen
        onComplete()
      })

      // Move to confirmation screen after 5 seconds
      setTimeout(() => {
        onConfirm()
      }, 10_000)
    } catch (error) {
      console.error('Error in prepareSend:', error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            {selectedToken.contractAddress ? (
              <TokenImage symbol={selectedToken.symbol} src={selectedToken.imageUrl} />
            ) : (
              <span className="text-2xl font-medium text-gray-600">{selectedToken.symbol[0]}</span>
            )}
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
              className="w-full flex items-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full flex items-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                <TokenImage symbol={selectedDestToken.symbol} src={selectedDestToken.imageUrl} size="sm" />
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
                    className={`w-full flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                      selectedDestToken.symbol === token.symbol ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                      <TokenImage symbol={token.symbol} src={token.imageUrl} size="sm" />
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
            value={recipientInput}
            onChange={handleRecipientInputChange}
            placeholder="0x..."
            className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400 font-mono text-sm"
          />
          {ensAddress ? <p className="text-sm text-gray-500">{recipient}</p> : null}
        </div>

        <div className="flex flex-col space-y-3">
          <button
            type="submit"
            disabled={!amount || !recipient || isSubmitting}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 cursor-pointer disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors relative"
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span>Processing...</span>
              </div>
            ) : (
              `Receive ${amount ? `${amount} ${selectedDestToken.symbol}` : ''}`
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full border border-gray-300 hover:border-gray-400 cursor-pointer text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>
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
