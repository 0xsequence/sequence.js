import React, { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useTokenBalances } from '../../tokenBalances.js'
import { Address } from 'ox'
import { formatUnits, isAddressEqual, zeroAddress } from 'viem'
import { NetworkImage, TokenImage } from '@0xsequence/design-system'
import * as chains from 'viem/chains'
import { Search, ArrowLeft } from 'lucide-react'

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

const allowedTokens = ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'OP', 'ARB', 'MATIC', 'XDAI', 'AVAX', 'BNB', 'OKB']

interface TokenListProps {
  onContinue: (selectedToken: Token) => void
  onBack: () => void
}

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

export const TokenList: React.FC<TokenListProps> = ({ onContinue, onBack }) => {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { address } = useAccount()
  const {
    sortedTokens: allSortedTokens,
    isLoadingBalances,
    balanceError,
  } = useTokenBalances(address as Address.Address)

  const sortedTokens = useMemo(() => {
    return allSortedTokens.filter((token: any) => {
      return !token.contractAddress || allowedTokens.includes(token.contractInfo?.symbol || '')
    })
  }, [allSortedTokens])

  const handleTokenSelect = (token: any) => {
    const isNative = !('contractAddress' in token)
    const chainInfo = getChainInfo(token.chainId) as any // TODO: Add proper type
    const contractAddress = isNative ? zeroAddress : token.contractAddress
    const imageUrl = `https://assets.sequence.info/images/tokens/small/${token.chainId}/${contractAddress}.webp`

    let formattedToken: Token
    if (isNative) {
      formattedToken = {
        id: token.chainId,
        name: chainInfo?.nativeCurrency.name || 'Native Token',
        symbol: chainInfo?.nativeCurrency.symbol || 'ETH',
        balance: token.balance,
        imageUrl,
        chainId: token.chainId,
        contractAddress: zeroAddress,
        contractInfo: {
          decimals: 18,
          symbol: chainInfo?.nativeCurrency.symbol || 'ETH',
          name: chainInfo?.nativeCurrency.name || 'Native Token',
        },
      }
    } else {
      formattedToken = {
        id: token.chainId,
        name: token.contractInfo?.name || 'Unknown Token',
        symbol: token.contractInfo?.symbol || '???',
        balance: token.balance,
        imageUrl,
        chainId: token.chainId,
        contractAddress: token.contractAddress,
        contractInfo: token.contractInfo,
      }
    }

    setSelectedToken(formattedToken)
  }

  const isTokenSelected = (token: any): boolean => {
    if (!selectedToken) return false

    const isNative = !('contractAddress' in token)
    return (
      selectedToken.chainId === token.chainId &&
      (isNative
        ? selectedToken.contractAddress === zeroAddress
        : isAddressEqual(Address.from(selectedToken.contractAddress), Address.from(token.contractAddress)))
    )
  }

  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedTokens
    }

    const query = searchQuery.toLowerCase().trim()
    return sortedTokens.filter((token: any) => {
      const isNative = !('contractAddress' in token)
      const chainInfo = getChainInfo(token.chainId) as any // TODO: Add proper type
      const chainName = chainInfo?.name || ''

      if (isNative) {
        const nativeSymbol = chainInfo?.nativeCurrency.symbol || 'ETH'
        const nativeName = chainInfo?.nativeCurrency.name || 'Native Token'
        return (
          nativeSymbol.toLowerCase().includes(query) ||
          nativeName.toLowerCase().includes(query) ||
          chainName.toLowerCase().includes(query)
        )
      }

      return (
        token.contractInfo?.symbol?.toLowerCase().includes(query) ||
        token.contractInfo?.name?.toLowerCase().includes(query) ||
        chainName.toLowerCase().includes(query)
      )
    })
  }, [sortedTokens, searchQuery])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select Token</h2>

      {/* Search Field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by token name, symbol, or chain..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
        />
      </div>

      {isLoadingBalances && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading your token balances...</p>
        </div>
      )}

      {balanceError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error loading balances: {balanceError.message}</p>
        </div>
      )}

      {!isLoadingBalances && !balanceError && filteredTokens.length === 0 && (
        <div className="text-center py-4 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {searchQuery.trim()
              ? 'No tokens found matching your search.'
              : 'No tokens found with balance greater than 0.'}
          </p>
        </div>
      )}

      <div className="divide-y divide-gray-200 max-h-[40vh] overflow-y-auto rounded-lg">
        {filteredTokens.map((token: any) => {
          const isNative = !('contractAddress' in token)
          const chainInfo = getChainInfo(token.chainId) as any // TODO: Add proper type
          const nativeSymbol = chainInfo?.nativeCurrency.symbol || 'ETH'
          const tokenSymbol = isNative ? nativeSymbol : token.contractInfo?.symbol || '???'
          const contractAddress = isNative ? zeroAddress : token.contractAddress
          const imageUrl = `https://assets.sequence.info/images/tokens/small/${token.chainId}/${contractAddress}.webp`
          const tokenName = isNative
            ? `${nativeSymbol} (${chainInfo?.name || 'Unknown Chain'})`
            : token.contractInfo?.name || 'Unknown Token'
          const formattedBalance = formatBalance(token.balance, isNative ? 18 : token.contractInfo?.decimals)

          return (
            <div
              key={isNative ? `${token.chainId}-native` : `${token.chainId}-${token.contractAddress}`}
              onClick={() => handleTokenSelect(token)}
              className={`py-4 px-4 flex items-center space-x-4 cursor-pointer transition-colors ${
                isTokenSelected(token) ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  {contractAddress ? (
                    <TokenImage symbol={tokenSymbol} src={imageUrl} />
                  ) : (
                    <span className="text-lg font-medium text-gray-600">{tokenSymbol[0]}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1">
                  <NetworkImage chainId={token.chainId} size="sm" className="w-4 h-4" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-gray-900 truncate">{tokenName}</h3>
                <p className="text-sm text-gray-500">{tokenSymbol}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-lg font-medium text-gray-900">{formattedBalance}</p>
                <p className="text-sm text-gray-500">{tokenSymbol}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-3">
        <button
          onClick={() => selectedToken && onContinue(selectedToken)}
          disabled={!selectedToken}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Continue
        </button>
        <button
          onClick={onBack}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 cursor-pointer font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>
      </div>
    </div>
  )
}

export default TokenList
