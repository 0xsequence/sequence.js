import React, { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useSourceTokenList, useTokenBalances } from '../../tokenBalances.js'
import { Address } from 'ox'
import { formatUnits, isAddressEqual, zeroAddress } from 'viem'
import { NetworkImage, TokenImage } from '@0xsequence/design-system'
import * as chains from 'viem/chains'
import { Search, ChevronLeft } from 'lucide-react'
import { SequenceIndexerGateway } from '@0xsequence/indexer'

interface Token {
  id: number
  name: string
  symbol: string
  balance: string
  imageUrl: string
  chainId: number
  contractAddress: string
  balanceUsdFormatted: string
  tokenPriceUsd: number
  contractInfo?: {
    decimals: number
    symbol: string
    name: string
  }
}

interface TokenListProps {
  onContinue: (selectedToken: Token) => void
  onBack: () => void
  indexerGatewayClient: SequenceIndexerGateway
  theme?: 'light' | 'dark'
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

export const TokenList: React.FC<TokenListProps> = ({ onContinue, onBack, indexerGatewayClient, theme = 'light' }) => {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { address } = useAccount()
  const {
    sortedTokens: allSortedTokens,
    isLoadingBalances,
    balanceError,
  } = useTokenBalances(address as Address.Address, indexerGatewayClient)

  const sourceTokenList = useSourceTokenList()

  const sortedTokens = useMemo(() => {
    return allSortedTokens.filter((token: any) => {
      return !token.contractAddress || sourceTokenList.includes(token.contractInfo?.symbol || '')
    })
  }, [allSortedTokens, sourceTokenList])

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
        balanceUsdFormatted: token.balanceUsdFormatted,
        tokenPriceUsd: token.price?.value ?? 0,
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
        balanceUsdFormatted: token.balanceUsdFormatted,
        tokenPriceUsd: token.price?.value ?? 0,
      }
    }

    setSelectedToken(formattedToken)
    onContinue(formattedToken)
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
          Select Token
        </h2>
      </div>

      {/* Search Field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by token name, symbol, or chain..."
          className={`block w-full pl-10 pr-3 py-2 border rounded-[24px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
        />
      </div>

      {isLoadingBalances && (
        <div className="text-center py-4">
          <div
            className={`animate-spin rounded-full h-8 w-8 border-b-2 mx-auto ${
              theme === 'dark' ? 'border-white' : 'border-black'
            }`}
          ></div>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            Loading your token balances...
          </p>
        </div>
      )}

      {balanceError && (
        <div
          className={`border rounded-lg p-4 mb-4 ${
            theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className={`h-5 w-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-400'}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-red-200' : 'text-red-800'}`}>
                Error loading balances
              </h3>
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-red-200' : 'text-red-700'}`}>
                {balanceError instanceof Error
                  ? balanceError.message
                  : 'Failed to fetch token balances. Please try again.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className={`mt-2 text-sm font-medium underline ${
                  theme === 'dark' ? 'text-red-200 hover:text-red-100' : 'text-red-700 hover:text-red-900'
                }`}
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoadingBalances && !balanceError && filteredTokens.length === 0 && (
        <div className={`text-center py-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
            {searchQuery.trim()
              ? 'No tokens found matching your search.'
              : 'No tokens found with balance greater than 0.'}
          </p>
        </div>
      )}

      {/* Token List */}
      <div
        className={`divide-y ${
          theme === 'dark' ? 'divide-gray-700/50' : 'divide-gray-200'
        } max-h-[35vh] overflow-y-auto rounded-[16px] ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'}`}
      >
        {filteredTokens.map((token: any) => {
          const isNative = !('contractAddress' in token)
          const chainInfo = getChainInfo(token.chainId) as any
          const nativeSymbol = chainInfo?.nativeCurrency.symbol || 'ETH'
          const tokenSymbol = isNative ? nativeSymbol : token.contractInfo?.symbol || '???'
          const contractAddress = isNative ? zeroAddress : token.contractAddress
          let imageContractAddress = contractAddress
          if (tokenSymbol === 'WETH') {
            imageContractAddress = zeroAddress
          }
          const imageUrl = `https://assets.sequence.info/images/tokens/small/${token.chainId}/${imageContractAddress}.webp`
          const tokenName = isNative
            ? `${nativeSymbol} (${chainInfo?.name || 'Unknown Chain'})`
            : token.contractInfo?.name || 'Unknown Token'
          const formattedBalance = formatBalance(token.balance, isNative ? 18 : token.contractInfo?.decimals)
          const priceUsd = Number(token.price?.value) ?? 0
          const balanceUsdFormatted = token.balanceUsdFormatted ?? ''

          return (
            <div
              key={isNative ? `${token.chainId}-native` : `${token.chainId}-${token.contractAddress}`}
              onClick={() => handleTokenSelect(token)}
              className={`py-2.5 px-3 flex items-center space-x-3 cursor-pointer transition-colors ${
                theme === 'dark'
                  ? isTokenSelected(token)
                    ? 'bg-gray-800'
                    : 'hover:bg-gray-800/80'
                  : isTokenSelected(token)
                    ? 'bg-gray-100'
                    : 'hover:bg-gray-50'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  {contractAddress ? (
                    <TokenImage symbol={tokenSymbol} src={imageUrl} />
                  ) : (
                    <span className={`text-base font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                      {tokenSymbol[0]}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5">
                  <NetworkImage chainId={token.chainId} size="sm" className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {tokenName}
                </h3>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{tokenSymbol}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {formattedBalance}
                </p>
                {priceUsd > 0 && (
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {balanceUsdFormatted}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-4">
        <button
          onClick={() => selectedToken && onContinue(selectedToken)}
          disabled={!selectedToken}
          className={`w-full font-semibold py-3 px-4 rounded-[24px] transition-colors ${
            theme === 'dark'
              ? 'bg-blue-600 disabled:bg-gray-700 text-white disabled:text-gray-400 enabled:hover:bg-blue-700'
              : 'bg-blue-500 disabled:bg-gray-300 text-white disabled:text-gray-500 enabled:hover:bg-blue-600'
          } disabled:cursor-not-allowed cursor-pointer`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default TokenList
