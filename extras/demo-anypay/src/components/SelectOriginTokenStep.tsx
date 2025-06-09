import React from 'react'
import { Text, NetworkImage } from '@0xsequence/design-system'
import { Hex, zeroAddress } from 'viem'
import { TokenBalance, NativeTokenBalance } from '@0xsequence/anypay-sdk'
import { SectionHeader } from '@/components/SectionHeader'
import { getChainInfo, formatBalance } from '@/utils/formatting'

interface SelectOriginTokenStepProps {
  isLoadingBalances: boolean
  balanceError: Error | null
  sortedTokens: (TokenBalance | NativeTokenBalance)[]
  selectedToken: TokenBalance | null
  setSelectedToken: (token: TokenBalance | null) => void
  clearIntent: () => void
}

export const SelectOriginTokenStep: React.FC<SelectOriginTokenStepProps> = ({
  isLoadingBalances,
  balanceError,
  sortedTokens,
  selectedToken,
  setSelectedToken,
  clearIntent,
}) => {
  return (
    <SectionHeader
      noFrame={true}
      titleContainerClassName="px-6 pt-6 pb-4 flex items-center justify-between w-full"
      contentContainerClassName="px-6 pb-4"
      isCollapsible={false}
      title={
        <div className="flex items-center">
          <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
            <span>2</span>
          </div>
          <h3 className="text-xl font-semibold text-white">Select Origin Token</h3>
        </div>
      }
      statusPill={
        <div className="px-3 py-1 rounded-full bg-gray-700/50 text-gray-300 text-sm flex items-center">
          <span
            className={`w-2 h-2 rounded-full ${isLoadingBalances ? 'bg-yellow-400' : sortedTokens.length > 0 ? 'bg-green-400' : 'bg-red-400'} mr-2 animate-pulse`}
          ></span>
          {isLoadingBalances ? 'Loading...' : sortedTokens.length > 0 ? `${sortedTokens.length} Tokens` : 'No Tokens'}
        </div>
      }
    >
      {isLoadingBalances && (
        <Text variant="small" color="secondary">
          Loading balances...
        </Text>
      )}
      {balanceError && (
        <Text variant="small" color="negative">
          Error loading balances: {balanceError.message}
        </Text>
      )}
      {!isLoadingBalances && !balanceError && sortedTokens.length === 0 && (
        <Text variant="small" color="secondary">
          No tokens with balance &gt; 0 found across any chain.
        </Text>
      )}
      <div className="max-h-60 overflow-y-auto border border-gray-700/50 rounded-lg p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {sortedTokens.map((token) => {
          const isNative = !('contractAddress' in token)
          const tokenBalance = isNative ? undefined : (token as TokenBalance)
          const chainInfo = getChainInfo(token.chainId)
          const nativeSymbol = chainInfo?.nativeCurrency.symbol || 'ETH'

          return (
            <div
              key={
                isNative
                  ? `${token.chainId}-native`
                  : `${tokenBalance?.chainId}-${tokenBalance?.contractAddress}-${tokenBalance?.tokenID ?? '0'}`
              }
              onClick={() => {
                if (isNative) {
                  const nativeToken = token as NativeTokenBalance
                  const nativeAsTokenBalanceShape = {
                    ...nativeToken,
                    contractAddress: zeroAddress as Hex,
                    contractType: 'ERC20', // Mimic ERC20 for selection logic
                    contractInfo: {
                      // Basic contractInfo structure
                      name: chainInfo?.nativeCurrency.name || 'Native Token',
                      symbol: chainInfo?.nativeCurrency.symbol || 'ETH',
                      decimals: 18,
                    },
                    // Ensure these fields are added to match the original cast's intent in home-index-route
                    blockHash: 'blockHash' in nativeToken && nativeToken.blockHash ? nativeToken.blockHash : '',
                    blockNumber: 'blockNumber' in nativeToken && nativeToken.blockNumber ? nativeToken.blockNumber : 0,
                    uniqueCollectibles:
                      'uniqueCollectibles' in nativeToken && nativeToken.uniqueCollectibles
                        ? nativeToken.uniqueCollectibles
                        : [],
                    isSummary:
                      'isSummary' in nativeToken && typeof nativeToken.isSummary === 'boolean'
                        ? nativeToken.isSummary
                        : true,
                  }
                  setSelectedToken(nativeAsTokenBalanceShape as unknown as TokenBalance)
                } else {
                  setSelectedToken(token as TokenBalance)
                }
                clearIntent()
              }}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex justify-between items-center ${selectedToken?.chainId === token.chainId && (isNative ? selectedToken?.contractAddress === zeroAddress : selectedToken?.contractAddress === (token as TokenBalance).contractAddress) ? 'bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 shadow-lg' : 'bg-gray-700/80 hover:bg-gray-600/90 hover:shadow-md'}`}
            >
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center mr-2 shadow-sm">
                    <Text variant="medium" color="primary" className="font-semibold">
                      {isNative ? nativeSymbol[0] : tokenBalance?.contractInfo?.symbol?.[0] || 'T'}
                    </Text>
                  </div>
                  <div className="absolute -bottom-1 right-0.5 w-5 h-5 rounded-full bg-gray-800 border-2 border-gray-700 shadow-sm">
                    <NetworkImage chainId={token.chainId} size="sm" className="w-full h-full" />
                  </div>
                </div>
                <div>
                  <Text variant="medium" color="primary" className="font-semibold">
                    {isNative
                      ? `${nativeSymbol} (${chainInfo?.name || 'Unknown Chain'})`
                      : tokenBalance?.contractInfo?.symbol || tokenBalance?.contractInfo?.name || 'Token'}
                  </Text>
                  {isNative && (
                    <Text
                      variant="small"
                      color="secondary"
                      className="ml-1 text-xs bg-blue-900/50 px-2 py-0.5 rounded-full"
                    >
                      Native
                    </Text>
                  )}
                </div>
              </div>
              <Text variant="small" color="secondary" className="font-mono bg-gray-800/50 px-3 py-1 rounded-full">
                {formatBalance(token)}
              </Text>
            </div>
          )
        })}
      </div>
      {selectedToken && (
        <div className="mt-3 bg-green-900/20 border border-green-700/30 rounded-lg p-2 animate-fadeIn">
          <Text variant="small" color="positive" className="flex flex-wrap items-center">
            <span className="bg-green-800 text-green-100 px-2 py-0.5 rounded-full text-xs mr-2">Selected</span>
            <span className="text-gray-300 font-semibold mr-1">
              {selectedToken.contractInfo?.symbol || 'Native Token'}
            </span>
            <span className="text-gray-400 text-xs">
              Chain: <span className="text-gray-300">{selectedToken.chainId}</span>
            </span>
            <span className="ml-2 text-gray-400 text-xs truncate max-w-full">
              Address: <span className="text-gray-300 font-mono">{selectedToken.contractAddress}</span>
            </span>
          </Text>
        </div>
      )}
    </SectionHeader>
  )
}
