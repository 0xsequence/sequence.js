import { useState, useMemo, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Connector } from 'wagmi'
import { useIndexerClient } from '@0xsequence/hooks'
import { ChainId } from '@0xsequence/network'
import { TokenBalance, GetTokenBalancesReturn } from '@0xsequence/indexer'
import { CreateIntentConfigReturn } from '@0xsequence/api'
import { formatUnits, Hex, zeroAddress } from 'viem'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAPIClient } from '../../hooks/useAPIClient'
import { Button, Text, NetworkImage } from '@0xsequence/design-system'
import { AbiFunction } from 'ox'

// Type guard for native token balance
function isNativeToken(token: TokenBalance): boolean {
  return !token.contractAddress || token.contractAddress === zeroAddress || token.contractInfo?.type === 'native'
}

// Types for intent actions
type IntentAction = 'pay' | 'mock_interaction'

// Helper to format balance
const formatBalance = (balance: TokenBalance) => {
  if (!balance.contractInfo?.decimals) return balance.balance
  try {
    // Format with sufficient precision, then potentially trim trailing zeros if needed later
    const formatted = formatUnits(BigInt(balance.balance), balance.contractInfo.decimals)
    // Avoid unnecessary trailing zeros from toFixed if the number is whole or has few decimals
    const num = parseFloat(formatted)
    if (num === 0) return '0'
    // Use intelligent formatting based on magnitude
    if (num < 0.0001) return num.toExponential(2)
    if (num < 1) return num.toFixed(6) // More precision for small fractions
    if (num < 1000) return num.toFixed(4)
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 }) // Compact for large numbers
  } catch (e) {
    console.error('Error formatting balance:', e)
    return balance.balance // Fallback
  }
}

// Mock Data
const MOCK_CONTRACT_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const MOCK_TRANSFER_DATA: Hex = `0xa9059cbb000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef00000000000000000000000000000000000000000000000000000000000f4240` // transfer(address,uint256) for 1 * 10^6

export const HomeIndexRoute = () => {
  const account = useAccount()
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null)
  const indexerClient = useIndexerClient((account.chainId as ChainId) || ChainId.MAINNET)
  const effectiveIndexerClient = account.chainId ? indexerClient : null
  const apiClient = useAPIClient()

  // State for intent results
  const [intentQuote, setIntentQuote] = useState<CreateIntentConfigReturn['quote'] | null>(null)

  // Default empty page info for query fallback
  const defaultPage = { page: 1, pageSize: 10, totalRecords: 0, more: false }

  // Fetch token balances
  const {
    data: tokenBalancesData,
    isLoading: isLoadingBalances,
    error: balanceError,
  } = useQuery<GetTokenBalancesReturn>({
    queryKey: ['tokenBalances', account.address],
    queryFn: async () => {
      if (!account.address || !effectiveIndexerClient) {
        console.warn('No account address or indexer client')

        return { balances: [], page: defaultPage }
      }
      try {
        const summary = await effectiveIndexerClient.getTokenBalancesSummary({
          filter: {
            accountAddresses: [account.address],
            omitNativeBalances: true,
          },
        })

        return {
          balances: summary.balances || [],
          page: defaultPage,
        }
      } catch (error) {
        console.error('Failed to fetch token balances:', error)
        return { balances: [], page: defaultPage }
      }
    },
    enabled: !!account.address && !!effectiveIndexerClient,
    staleTime: 30000,
    retry: 1,
  })

  const createIntentMutation = useMutation<CreateIntentConfigReturn, Error, IntentAction>({
    mutationFn: async (action: IntentAction) => {
      if (!apiClient || !selectedToken || !account.chainId || !account.address) {
        throw new Error('Missing API client, selected token, chain ID, or account address')
      }

      const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
      const RECIPIENT_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      const AMOUNT = 30000000n // 30 USDC (6 decimals)

      const destinationChainId = selectedToken.chainId
      const isOriginNative = isNativeToken(selectedToken)

      let destinationCall
      if (action === 'pay') {
        // ERC20 ABI functions
        const erc20Transfer = AbiFunction.from('function transfer(address,uint256) returns (bool)')

        destinationCall = {
          chainId: 8453,
          to: USDC_ADDRESS,
          transactionData: AbiFunction.encodeData(erc20Transfer, [RECIPIENT_ADDRESS, AMOUNT]) as Hex,
          transactionValue: '0',
        }
      } else {
        destinationCall = {
          chainId: destinationChainId,
          to: USDC_ADDRESS,
          transactionData: MOCK_TRANSFER_DATA,
          transactionValue: '0',
        }
      }

      const args = {
        userAddress: account.address,
        originChainId: selectedToken.chainId,
        originTokenAddress: isOriginNative ? zeroAddress : selectedToken.contractAddress,
        destinationChainId: destinationChainId,
        destinationToAddress: destinationCall.to,
        destinationTokenAddress: USDC_ADDRESS,
        destinationTokenAmount: action === 'pay' ? AMOUNT.toString() : '0',
        destinationCallData: destinationCall.transactionData,
        destinationCallValue: destinationCall.transactionValue,
      }

      console.log('Calling createIntentConfig with args:', args)
      return await apiClient.createIntentConfig(args)
    },
    onSuccess: (data) => {
      console.log('Intent Config Success:', data)
      if (data.quote) {
        setIntentQuote(data.quote)
      } else {
        console.warn('API returned success but no quote found.')
        setIntentQuote(null)
      }
    },
    onError: (error) => {
      console.error('Intent Config Error:', error)
      setIntentQuote(null)
    },
  })

  const sortedTokens = useMemo(() => {
    if (!tokenBalancesData?.balances) {
      return []
    }
    const balances: TokenBalance[] = tokenBalancesData.balances || []

    return [...balances]
      .filter((token) => {
        try {
          return BigInt(token.balance) > 0n
        } catch {
          return false
        }
      })
      .sort((a, b) => {
        if (isNativeToken(a)) return -1
        if (isNativeToken(b)) return 1
        try {
          const balanceA = BigInt(a.balance)
          const balanceB = BigInt(b.balance)
          if (balanceA > balanceB) return -1
          if (balanceA < balanceB) return 1
          return 0
        } catch {
          return 0
        }
      })
  }, [tokenBalancesData])

  useEffect(() => {
    setSelectedToken(null)
    setIntentQuote(null)
  }, [account.address, account.chainId])

  const handleActionClick = (action: IntentAction) => {
    setIntentQuote(null)
    createIntentMutation.mutate(action)
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto min-h-screen">
      <div className="text-center mb-8 animate-fadeIn">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
          Sequence Anypay Demo
        </h1>
        <p className="text-gray-300 text-sm">Connect your wallet and explore cross-chain payment intents</p>
      </div>

      {/* Account Info & Connect/Disconnect */}
      <div className="bg-gray-800/80 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm transition-all duration-300 hover:shadow-blue-900/20">
        <h2 className="text-xl font-semibold text-white mb-4">Account</h2>
        {account.status === 'connected' ? (
          <div className="text-sm text-gray-300 break-all">
            <Text variant="small" color="secondary">
              Address: {account.address}
            </Text>
            <br />
            <Text variant="small" color="secondary">
              Chain ID: {account.chainId}
            </Text>
            <br />
            <Text variant="small" color="secondary">
              Status: <span className="text-green-400">{account.status}</span>
            </Text>
            <br />
            <Button variant="danger" size="small" onClick={() => disconnect()} className="mt-3 px-5 py-2">
              Disconnect
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-gray-300 mb-3">Select a wallet to connect:</p>
            <div className="flex flex-wrap gap-2 mb-4" data-component-name="HomeIndexRoute">
              {connectors.map((connector: Connector) => (
                <Button
                  key={connector.uid}
                  variant="primary"
                  size="small"
                  onClick={() => connect({ connector })}
                  className="px-5 py-2 transition-all duration-300 transform hover:scale-105 hover:shadow-lg shadow-md"
                >
                  {connector.name}
                </Button>
              ))}
            </div>
            <div className="text-sm text-gray-400">
              <Text variant="small" color="secondary">
                Status: <span className="text-yellow-400">{account.status}</span>
                {connectStatus === 'pending' && <span> (Connecting...)</span>}
              </Text>
            </div>
            {connectError && (
              <Text variant="small" color="error" className="mt-1">
                Error: {connectError.message}
              </Text>
            )}
          </div>
        )}
      </div>

      {/* Token selection, Actions, and Intent Display */}
      {account.status === 'connected' && (
        <div className="bg-gray-800/80 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm space-y-6 transition-all duration-300 hover:shadow-blue-900/20">
          {/* 1. Select Token */}
          <div>
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                <span>1</span>
              </div>
              <h3 className="text-xl font-semibold text-white">Select Origin Token</h3>
            </div>
            {isLoadingBalances && (
              <Text variant="small" color="secondary">
                Loading balances...
              </Text>
            )}
            {balanceError && (
              <Text variant="small" color="error">
                Error loading balances: {balanceError.message}
              </Text>
            )}
            {!isLoadingBalances && !balanceError && sortedTokens.length === 0 && (
              <Text variant="small" color="secondary">
                No tokens with balance &gt; 0 found across any chain.
              </Text>
            )}
            <div className="max-h-60 overflow-y-auto border border-gray-700/50 rounded-lg p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {sortedTokens.map((token: TokenBalance) => (
                <div
                  key={`${token.chainId}-${token.contractAddress}-${token.tokenID ?? '0'}`}
                  onClick={() => {
                    setSelectedToken(token)
                    setIntentQuote(null)
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex justify-between items-center ${selectedToken?.contractAddress === token.contractAddress && selectedToken?.chainId === token.chainId ? 'bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 shadow-lg' : 'bg-gray-700/80 hover:bg-gray-600/90 hover:shadow-md'}`}
                >
                  <div className="flex items-center">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center mr-2 shadow-sm">
                        <Text variant="medium" color="primary" className="font-semibold">
                          {token.contractInfo?.symbol?.[0] || 'T'}
                        </Text>
                      </div>
                      <div className="absolute -bottom-1 right-0.5 w-5 h-5 rounded-full bg-gray-800 border-2 border-gray-700 shadow-sm">
                        <NetworkImage chainId={token.chainId} size="sm" className="w-full h-full" />
                      </div>
                    </div>
                    <div>
                      <Text variant="medium" color="primary" className="font-semibold">
                        {token.contractInfo?.symbol || token.contractInfo?.name || 'Native Token'}
                      </Text>
                      {isNativeToken(token) && (
                        <Text
                          variant="small"
                          color="accent"
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
              ))}
            </div>
            {selectedToken && (
              <div className="mt-3 bg-green-900/20 border border-green-700/30 rounded-lg p-2 animate-fadeIn">
                <Text variant="small" color="success" className="flex flex-wrap items-center">
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
          </div>

          {/* 2. Choose Action */}
          <div>
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                <span>2</span>
              </div>
              <h3 className="text-xl font-semibold text-white">Choose Action</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => handleActionClick('pay')}
                disabled={!selectedToken || createIntentMutation.isPending}
                className="px-5 py-2.5 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
              >
                {createIntentMutation.isPending && createIntentMutation.variables === 'pay' ? (
                  'Processing...'
                ) : (
                  <>
                    <NetworkImage chainId={8453} size="sm" className="w-5 h-5" />
                    <span>Pay Action (0.03 USDC on Base)</span>
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleActionClick('mock_interaction')}
                disabled={!selectedToken || createIntentMutation.isPending}
                className="px-5 py-2.5 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
              >
                {createIntentMutation.isPending && createIntentMutation.variables === 'mock_interaction' ? (
                  'Processing...'
                ) : (
                  <>
                    <NetworkImage chainId={selectedToken?.chainId || 8453} size="sm" className="w-5 h-5" />
                    <span>Mock Interaction</span>
                  </>
                )}
              </Button>
            </div>
            {!selectedToken && (
              <Text
                variant="small"
                color="warning"
                className="mt-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-2 flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Please select a token first.
              </Text>
            )}
          </div>

          {/* 3. Intent Quote Display */}
          <div>
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                <span>3</span>
              </div>
              <h3 className="text-xl font-semibold text-white">Intent Quote</h3>
            </div>
            {createIntentMutation.isPending && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 animate-pulse">
                <div className="flex items-center text-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2 text-yellow-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <Text variant="small" color="warning">
                    Generating intent quote...
                  </Text>
                </div>
              </div>
            )}
            {createIntentMutation.isError && (
              <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                <Text variant="small" color="negative" className="break-words flex items-center text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Error: {createIntentMutation.error.message}</span>
                </Text>
              </div>
            )}
            {intentQuote && (
              <div className="text-xs text-gray-300 bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
                <div className="absolute right-3 top-3 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  Intent Quote
                </div>
                <Text
                  variant="medium"
                  color="primary"
                  className="mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Origin Call (Send Funds Here):
                </Text>
                <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">To (One-Time Wallet):</strong>{' '}
                    <span className="text-yellow-300 break-all font-mono">{intentQuote.originCall.to}</span>
                  </Text>
                </div>
                <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Value:</strong>
                    <span className="font-mono">{intentQuote.originCall.transactionValue}</span>
                  </Text>
                </div>
                <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                  <Text variant="small" color="secondary" className="break-all">
                    <strong className="text-blue-300">Data:</strong>
                    <span className="font-mono text-green-300">{intentQuote.originCall.transactionData}</span>
                  </Text>
                </div>
                <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Chain ID:</strong>
                    <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded-full">
                      {intentQuote.originCall.chainId}
                    </span>
                  </Text>
                </div>

                {intentQuote.preconditions && intentQuote.preconditions.length > 0 && (
                  <>
                    <Text
                      variant="medium"
                      color="primary"
                      className="mt-4 mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      Preconditions (Actions after funds arrive):
                    </Text>
                    <ul className="space-y-2 pl-2">
                      {intentQuote.preconditions.map((cond, index) => (
                        <li
                          key={index}
                          className="break-all bg-gray-800/70 p-2 rounded-md border-l-2 border-purple-500"
                        >
                          <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(cond, null, 2)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {!intentQuote.preconditions?.length && (
                  <div className="bg-gray-800/70 p-3 rounded-md border border-gray-700/50 mt-3">
                    <Text variant="small" color="secondary" className="flex items-center text-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1 text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      No specific preconditions returned for this intent.
                    </Text>
                  </div>
                )}
              </div>
            )}

            {!createIntentMutation.isPending && !createIntentMutation.isError && !intentQuote && (
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-4 flex items-center justify-center">
                <Text variant="small" color="secondary" className="flex flex-col items-center text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-gray-600 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Select a token and click an action above to generate the intent quote.
                </Text>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
