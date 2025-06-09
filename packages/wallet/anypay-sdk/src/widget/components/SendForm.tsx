import React, { useState, useRef, useEffect, useMemo } from 'react'
import { NetworkImage, TokenImage } from '@0xsequence/design-system'
import * as chains from 'viem/chains'
import { formatUnits, parseUnits, type Account, isAddress, getAddress, WalletClient } from 'viem'
import { ChevronDown, Loader2, ChevronLeft } from 'lucide-react'
import { prepareSend, TransactionState } from '../../anypay.js'
import { getAPIClient, useAPIClient } from '../../apiClient.js'
import { getRelayer } from '../../relayer.js'
import { zeroAddress } from 'viem'
import { useEnsAddress } from 'wagmi'
import { mainnet } from 'viem/chains'
import { formatBalance } from '../../tokenBalances.js'
import { useTokenPrices } from '../../prices.js'

interface Token {
  id: number
  name: string
  symbol: string
  balance: string
  imageUrl: string
  chainId: number
  contractAddress: string
  tokenPriceUsd?: number
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
  onComplete: (data: any) => void // TODO: Add proper type
  account: Account
  sequenceApiKey: string
  apiUrl?: string
  env?: 'local' | 'cors-anywhere' | 'dev' | 'prod'
  toRecipient?: string
  toAmount?: string
  toChainId?: number
  toToken?: 'USDC' | 'ETH'
  toCalldata?: string
  walletClient?: WalletClient
  theme?: 'light' | 'dark'
  onTransactionStateChange: (transactionStates: TransactionState[]) => void
}

// Available chains
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum', icon: chains.mainnet.id },
  { id: 8453, name: 'Base', icon: chains.base.id },
  { id: 10, name: 'Optimism', icon: chains.optimism.id },
  { id: 42161, name: 'Arbitrum', icon: chains.arbitrum.id },
  { id: 137, name: 'Polygon', icon: chains.polygon.id },
]

// Available tokens
const SUPPORTED_TOKENS = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: `https://assets.sequence.info/images/tokens/small/1/0x0000000000000000000000000000000000000000.webp`,
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    imageUrl: `https://assets.sequence.info/images/tokens/small/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.webp`,
    decimals: 6,
  },
]

// Helper to get chain info
const getChainInfo = (chainId: number) => {
  // TODO: Add proper type
  return Object.values(chains).find((chain: any) => chain.id === chainId) || null
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

  if (chainId === 137) {
    if (tokenSymbol === 'USDC') {
      return '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
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
  toAmount,
  toRecipient,
  toChainId,
  toToken,
  toCalldata,
  walletClient,
  theme = 'light',
  onTransactionStateChange,
}) => {
  const [amount, setAmount] = useState(toAmount ?? '')
  const [recipientInput, setRecipientInput] = useState(toRecipient ?? '')
  const [recipient, setRecipient] = useState(toRecipient ?? '')
  const [error, setError] = useState<string | null>(null)
  const { data: ensAddress } = useEnsAddress({
    name: recipientInput?.endsWith('.eth') ? recipientInput : undefined,
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
    () => (SUPPORTED_CHAINS.find((chain) => chain.id === (toChainId ?? selectedToken.chainId)) || SUPPORTED_CHAINS[0])!,
  )
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false)
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
  const [selectedDestToken, setSelectedDestToken] = useState(() =>
    toToken ? SUPPORTED_TOKENS.find((token) => token.symbol === toToken) || SUPPORTED_TOKENS[0]! : SUPPORTED_TOKENS[0]!,
  )

  const apiClient = useAPIClient({ apiUrl, projectAccessKey: sequenceApiKey })

  const { data: destTokenPrices } = useTokenPrices(
    selectedDestToken
      ? [
          {
            tokenId: selectedDestToken.symbol,
            contractAddress: getDestTokenAddress(selectedChain.id, selectedDestToken.symbol),
            chainId: selectedChain.id,
          },
        ]
      : [],
    apiClient,
  )

  // Update selectedChain when toChainId prop changes
  useEffect(() => {
    if (toChainId) {
      const newChain = SUPPORTED_CHAINS.find((chain) => chain.id === toChainId)
      if (newChain) {
        setSelectedChain(newChain)
      }
    }
  }, [toChainId])

  // Update selectedDestToken when toToken prop changes
  useEffect(() => {
    if (toToken) {
      const newToken = SUPPORTED_TOKENS.find((token) => token.symbol === toToken)
      if (newToken) {
        setSelectedDestToken(newToken)
      }
    }
  }, [toToken])

  // Update amount when toAmount prop changes
  useEffect(() => {
    setAmount(toAmount ?? '')
  }, [toAmount])

  const chainDropdownRef = useRef<HTMLDivElement>(null)
  const tokenDropdownRef = useRef<HTMLDivElement>(null)
  const chainInfo = getChainInfo(selectedToken.chainId) as any // TODO: Add proper type
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWaitingForWalletConfirm, setIsWaitingForWalletConfirm] = useState(false)

  const formattedBalance = formatBalance(selectedToken.balance, selectedToken.contractInfo?.decimals)
  const balanceUsdFormatted = (selectedToken as any).balanceUsdFormatted ?? '' // TODO: Add proper type

  const isValidRecipient = recipient && isAddress(recipient)

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

  // Calculate USD value
  const amountUsdValue = useMemo(() => {
    const amountUsd = parseFloat(amount) * (destTokenPrices?.[0]?.price?.value ?? 0)
    return Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountUsd)
  }, [amount, destTokenPrices])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      setIsSubmitting(true)
      const decimals = selectedDestToken?.decimals
      const parsedAmount = parseUnits(amount, decimals).toString()

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
        fee: '0',
        client: walletClient!,
        apiClient,
        originRelayer,
        destinationRelayer,
        destinationCalldata: toCalldata,
        dryMode: false, // Set to true to skip the metamask transaction, for testing purposes
        onTransactionStateChange: (transactionStates: TransactionState[]) => {
          onTransactionStateChange(transactionStates)
        },
      }

      console.log('options', options)

      const { intentAddress, send } = await prepareSend(options)
      console.log('Intent address:', intentAddress?.toString())

      function onOriginSend() {
        onConfirm()
        setIsWaitingForWalletConfirm(false)
        onSend(amount, recipient)
      }

      setIsWaitingForWalletConfirm(true)
      // Wait for full send to complete
      const { originUserTxReceipt, originMetaTxnReceipt, destinationMetaTxnReceipt } = await send(onOriginSend)

      // Move to receipt screen
      onComplete({
        originChainId: selectedToken.chainId,
        destinationChainId: selectedChain.id,
        originUserTxReceipt,
        originMetaTxnReceipt,
        destinationMetaTxnReceipt,
      })
    } catch (error) {
      console.error('Error in prepareSend:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
    }

    setIsSubmitting(false)
    setIsWaitingForWalletConfirm(false)
  }

  // Get button text based on recipient and calldata
  const buttonText = useMemo(() => {
    if (isWaitingForWalletConfirm) return 'Waiting for wallet...'
    if (isSubmitting) return 'Processing...'
    if (!amount) return 'Enter amount'
    if (!isValidRecipient) return 'Enter recipient'

    try {
      const checksummedRecipient = getAddress(recipient)
      const checksummedAccount = getAddress(account.address)

      if (checksummedRecipient === checksummedAccount) {
        return `Receive ${amount} ${selectedDestToken.symbol}`
      } else if (toCalldata) {
        return `Spend ${amount} ${selectedDestToken.symbol}`
      } else {
        return `Pay ${amount} ${selectedDestToken.symbol}`
      }
    } catch {
      return `Send ${amount} ${selectedDestToken.symbol}`
    }
  }, [
    amount,
    isValidRecipient,
    recipient,
    account.address,
    selectedDestToken.symbol,
    toCalldata,
    isWaitingForWalletConfirm,
    isSubmitting,
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center relative">
        <button
          onClick={onBack}
          className={`absolute -left-2 p-2 rounded-full transition-colors cursor-pointer ${
            theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h2 className={`text-lg font-semibold w-full text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Send Payment
        </h2>
      </div>

      <div className={`flex items-center space-x-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="relative">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            }`}
          >
            {selectedToken.contractAddress ? (
              <TokenImage symbol={selectedToken.symbol} src={selectedToken.imageUrl} />
            ) : (
              <span className={`text-2xl font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                {selectedToken.symbol[0]}
              </span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1">
            <NetworkImage chainId={selectedToken.chainId} size="sm" className="w-6 h-6" />
          </div>
        </div>
        <div>
          <h3 className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            From: {selectedToken.name}
          </h3>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
            on {chainInfo?.name || 'Unknown Chain'}
          </p>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
            Balance: {formattedBalance} {selectedToken.symbol}
            {balanceUsdFormatted && (
              <span className={`ml-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                ({balanceUsdFormatted})
              </span>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Chain Selection */}
        <div className="space-y-2">
          <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Destination Chain
          </label>
          {toChainId ? (
            <div
              className={`flex items-center px-4 py-3 border rounded-lg ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <NetworkImage chainId={selectedChain.icon} size="sm" className="w-5 h-5" />
              <span className={`ml-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedChain.name}</span>
            </div>
          ) : (
            <div className="relative" ref={chainDropdownRef}>
              <button
                type="button"
                onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                className={`w-full flex items-center px-4 py-3 border rounded-[24px] hover:border-gray-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <NetworkImage chainId={selectedChain.icon} size="sm" className="w-5 h-5" />
                <span className="ml-2 flex-1 text-left">{selectedChain.name}</span>
                <ChevronDown
                  className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'} transition-transform ${
                    isChainDropdownOpen ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {isChainDropdownOpen && (
                <div
                  className={`absolute z-10 w-full mt-1 border rounded-[24px] shadow-lg ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  {SUPPORTED_CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      onClick={() => {
                        setSelectedChain(chain)
                        setIsChainDropdownOpen(false)
                      }}
                      className={`w-full flex items-center px-4 py-3 ${
                        theme === 'dark'
                          ? selectedChain.id === chain.id
                            ? 'bg-gray-700 text-white'
                            : 'text-white hover:bg-gray-700'
                          : selectedChain.id === chain.id
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <NetworkImage chainId={chain.icon} size="sm" className="w-5 h-5" />
                      <span className="ml-2">{chain.name}</span>
                      {selectedChain.id === chain.id && (
                        <span className={`ml-auto ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>•</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Token Selection */}
        <div className="space-y-2">
          <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Receive Token
          </label>
          {toToken ? (
            <div
              className={`flex items-center px-4 py-3 border rounded-lg ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-sm ${
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                }`}
              >
                <TokenImage symbol={selectedDestToken.symbol} src={selectedDestToken.imageUrl} size="sm" />
              </div>
              <span className={`ml-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {selectedDestToken.name}
              </span>
            </div>
          ) : (
            <div className="relative" ref={tokenDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                className={`w-full flex items-center px-4 py-3 border rounded-[24px] hover:border-gray-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-sm ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <TokenImage symbol={selectedDestToken.symbol} src={selectedDestToken.imageUrl} size="sm" />
                </div>
                <span className="ml-2 flex-1 text-left">{selectedDestToken.name}</span>
                <ChevronDown
                  className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'} transition-transform ${
                    isTokenDropdownOpen ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {isTokenDropdownOpen && (
                <div
                  className={`absolute z-10 w-full mt-1 border rounded-[24px] shadow-lg ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  {SUPPORTED_TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      onClick={() => {
                        setSelectedDestToken(token)
                        setIsTokenDropdownOpen(false)
                      }}
                      className={`w-full flex items-center px-4 py-3 cursor-pointer ${
                        theme === 'dark'
                          ? selectedDestToken.symbol === token.symbol
                            ? 'bg-gray-700 text-white'
                            : 'text-white hover:bg-gray-700'
                          : selectedDestToken.symbol === token.symbol
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-sm ${
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        }`}
                      >
                        <TokenImage symbol={token.symbol} src={token.imageUrl} size="sm" />
                      </div>
                      <span className="ml-2">{token.name}</span>
                      {selectedDestToken.symbol === token.symbol && (
                        <span className={`ml-auto ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>•</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label
              htmlFor="amount"
              className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Amount to Receive
            </label>
          </div>
          {toAmount ? (
            <div
              className={`px-4 py-3 border rounded-lg ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <span className={`break-all ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {toAmount} {selectedDestToken.symbol}
              </span>
            </div>
          ) : (
            <div className="relative rounded-lg">
              <input
                id="amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`block w-full pl-4 pr-12 py-3 border rounded-[24px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{selectedDestToken.symbol}</span>
              </div>
            </div>
          )}
          {amount && selectedDestToken.symbol && (
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>≈ {amountUsdValue}</div>
          )}
        </div>

        {/* Recipient Input */}
        <div className="space-y-2">
          <label
            htmlFor="recipient"
            className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Recipient Address
          </label>
          {toRecipient ? (
            <div
              className={`px-4 py-3 border rounded-lg font-mono text-sm ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <span
                className={`break-all overflow-hidden text-ellipsis ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {recipient}
              </span>
            </div>
          ) : (
            <>
              <input
                id="recipient"
                type="text"
                value={recipientInput}
                onChange={handleRecipientInputChange}
                placeholder="0x... or name.eth"
                className={`block w-full px-4 py-3 border rounded-[24px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              {ensAddress && (
                <p className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>{recipient}</p>
              )}
            </>
          )}
        </div>

        {/* Custom Calldata Message */}
        {toCalldata && (
          <div
            className={`px-4 py-3 border rounded-lg ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <p className={`text-sm break-words ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              This transaction includes custom calldata for contract interaction
            </p>
          </div>
        )}

        <div className="flex flex-col space-y-3">
          {error && (
            <div
              className={`border rounded-lg p-4 ${
                theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
              }`}
            >
              <p className={`text-sm break-words ${theme === 'dark' ? 'text-red-200' : 'text-red-600'}`}>{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={!amount || !isValidRecipient || isSubmitting}
            className={`w-full font-semibold py-3 px-4 rounded-[24px] transition-colors relative ${
              theme === 'dark'
                ? 'bg-blue-600 disabled:bg-gray-700 text-white disabled:text-gray-400 enabled:hover:bg-blue-700'
                : 'bg-blue-500 disabled:bg-gray-300 text-white disabled:text-gray-500 enabled:hover:bg-blue-600'
            } disabled:cursor-not-allowed cursor-pointer`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <Loader2 className={`w-5 h-5 animate-spin mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-white'}`} />
                <span>{buttonText}</span>
              </div>
            ) : (
              buttonText
            )}
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
