import { useState, useMemo, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useSendTransaction } from 'wagmi'
import { Connector } from 'wagmi'
import { useIndexerGatewayClient } from '@0xsequence/hooks'
import { NativeTokenBalance, TokenBalance } from '@0xsequence/indexer'
import { GetTokenBalancesSummaryReturn } from '@0xsequence/indexer/dist/declarations/src/indexergw.gen'
import { GetIntentOperationsReturn, IntentOperation, IntentPrecondition } from '@0xsequence/api'
import { formatUnits, Hex, isAddressEqual, zeroAddress } from 'viem'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAPIClient } from '../../hooks/useAPIClient'
import { Button, Text, NetworkImage } from '@0xsequence/design-system'
import { AbiFunction, Address, Bytes } from 'ox'
import * as chains from 'viem/chains'
import { AnyPay } from '@0xsequence/wallet-core'
import { Context as ContextLike } from '@0xsequence/wallet-primitives'
import { useWaitForTransactionReceipt } from 'wagmi'
import { Relayer } from '@0xsequence/wallet-core'

// Type guard for native token balance
function isNativeToken(token: TokenBalance | NativeTokenBalance): boolean {
  if ('contractAddress' in token) {
    return false // If it has contractAddress, it's an ERC20 token
  }
  return true // NativeTokenBalance is always a native token
}

// Types for intent actions
type IntentAction = 'pay' | 'mock_interaction' | 'custom_call'

// Helper to format balance
const formatBalance = (balance: TokenBalance | NativeTokenBalance) => {
  try {
    if ('contractAddress' in balance) {
      // ERC20 token
      if (!balance.contractInfo?.decimals) return balance.balance
      const formatted = formatUnits(BigInt(balance.balance), balance.contractInfo.decimals)
      const num = parseFloat(formatted)
      if (num === 0) return '0'
      if (num < 0.0001) return num.toExponential(2)
      if (num < 1) return num.toFixed(6)
      if (num < 1000) return num.toFixed(4)
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
    } else {
      // Native token
      const formatted = formatUnits(BigInt(balance.balance), 18)
      const num = parseFloat(formatted)
      if (num === 0) return '0'
      if (num < 0.0001) return num.toExponential(2)
      if (num < 1) return num.toFixed(6)
      if (num < 1000) return num.toFixed(4)
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
  } catch (e) {
    console.error('Error formatting balance:', e)
    return balance.balance
  }
}

// Mock Data
const MOCK_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'
// Mock Calldata for interaction
const MOCK_TRANSFER_DATA: Hex = `0xabcdef`
// Mock Chain ID for interaction
const MOCK_CHAIN_ID = chains.arbitrum.id
// Mock Token Address for interaction on destination chain
const MOCK_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'
// Mock Token Amount for interaction on destination chain
const MOCK_TOKEN_AMOUNT = '300'

// Helper to get chain info
const getChainInfo = (chainId: number) => {
  // Find the chain by ID in all available chains
  return Object.values(chains).find((chain) => chain.id === chainId) || null
}

export const HomeIndexRoute = () => {
  const account = useAccount()
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { sendTransaction, isPending: isSendingTransaction } = useSendTransaction()
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null)
  const [showCustomCallForm, setShowCustomCallForm] = useState(false)
  const [customCallData, setCustomCallData] = useState({
    to: '',
    data: '',
    value: '0',
    chainId: '8453',
    tokenAmount: '0',
    tokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Default to USDC
  })
  const indexerClient = useIndexerGatewayClient()
  const apiClient = useAPIClient()
  const relayer = useMemo(() => {
    return new Relayer.Rpc.RpcRelayer('https://relayer.sequence.app')
  }, [])

  // State for intent results
  const [intentOperations, setIntentOperations] = useState<GetIntentOperationsReturn['operations'] | null>(null)
  const [intentPreconditions, setIntentPreconditions] = useState<GetIntentOperationsReturn['preconditions'] | null>(
    null,
  )
  const [txnHash, setTxnHash] = useState<Hex | undefined>()

  // Default empty page info for query fallback
  const defaultPage = { page: 1, pageSize: 10, totalRecords: 0, more: false }

  // Fetch token balances
  const {
    data: tokenBalancesData,
    isLoading: isLoadingBalances,
    error: balanceError,
  } = useQuery<GetTokenBalancesSummaryReturn>({
    queryKey: ['tokenBalances', account.address],
    queryFn: async () => {
      if (!account.address) {
        console.warn('No account address or indexer client')
        return { balances: [], nativeBalances: [], page: defaultPage } as GetTokenBalancesSummaryReturn
      }
      try {
        const summary = await indexerClient.getTokenBalancesSummary({
          filter: {
            accountAddresses: [account.address],
            omitNativeBalances: false,
          },
        })

        return summary
      } catch (error) {
        console.error('Failed to fetch token balances:', error)
        return { balances: [], nativeBalances: [], page: defaultPage } as GetTokenBalancesSummaryReturn
      }
    },
    enabled: !!account.address,
    staleTime: 30000,
    retry: 1,
  })

  const [verificationStatus, setVerificationStatus] = useState<{
    success: boolean
    receivedAddress?: string
    calculatedAddress?: string
  } | null>(null)

  // Add new state for relayer status
  const [metaTxnStatus, setMetaTxnStatus] = useState<{
    txnHash?: string
    status?: string
    revertReason?: string
    gasUsed?: number
    effectiveGasPrice?: string
  } | null>(null)

  const [preconditionStatuses, setPreconditionStatuses] = useState<boolean[]>([])

  console.log('setMetaTxnStatus', setMetaTxnStatus)
  console.log('setPreconditionStatuses', setPreconditionStatuses)

  const updateMetaTxnStatus = (
    hash: Hex | undefined,
    status: 'success' | 'reverted' | 'pending' | 'sending',
    gasUsed?: bigint,
    effectiveGasPrice?: bigint,
    revertReason?: string | null,
  ) => {
    setMetaTxnStatus({
      txnHash: hash,
      status:
        status === 'success'
          ? 'Success'
          : status === 'reverted'
            ? 'Failed'
            : status === 'sending'
              ? 'Sending...'
              : 'Pending',
      revertReason: status === 'reverted' ? revertReason || 'Transaction reverted' : undefined,
      gasUsed: gasUsed ? Number(gasUsed) : undefined,
      effectiveGasPrice: effectiveGasPrice?.toString(),
    })
  }

  const checkPreconditionStatuses = async () => {
    if (!intentPreconditions || !relayer) return // Use instantiated relayer

    const statuses = await Promise.all(
      intentPreconditions.map(async (precondition) => {
        try {
          return await relayer.checkPrecondition(precondition)
        } catch (error) {
          console.error('Error checking precondition:', error)
          return false
        }
      }),
    )

    setPreconditionStatuses(statuses)
  }

  const commitIntentConfigMutation = useMutation({
    mutationFn: async (args: {
      walletAddress: string
      mainSigner: string
      operations: IntentOperation[]
      preconditions: IntentPrecondition[]
    }) => {
      if (!apiClient) throw new Error('API client not available')

      try {
        if (!account.address) {
          throw new Error('Account address not available')
        }
        const mainSigner = Address.from(account.address)
        const context: ContextLike.Context = {
          factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447',
          stage1: '0x656e2d390E76f3Fba9f0770Dd0EcF4707eee3dF1',
          creationCode: '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3',
        }

        const coreOperations: AnyPay.IntentOperation[] = args.operations.map((op) => ({
          chainId: BigInt(op.chainId),
          space: op.space ? BigInt(op.space) : undefined,
          nonce: op.nonce ? BigInt(op.nonce) : undefined,
          calls: op.calls.map((call) => ({
            to: Address.from(call.to),
            value: BigInt(call.value || '0'),
            data: Bytes.from((call.data as Hex) || '0x'),
            gasLimit: BigInt(call.gasLimit || '0'),
            delegateCall: !!call.delegateCall,
            onlyFallback: !!call.onlyFallback,
            behaviorOnError: call.behaviorOnError !== undefined ? BigInt(call.behaviorOnError) : 0n,
          })),
        }))

        const calculatedAddress = AnyPay.calculateIntentConfigurationAddress(coreOperations, mainSigner, context)
        const receivedAddress = args.operations[0]?.calls[0]?.to

        const verificationResult = {
          success: Boolean(receivedAddress && isAddressEqual(Address.from(receivedAddress), calculatedAddress)),
          receivedAddress: receivedAddress || '',
          calculatedAddress: calculatedAddress.toString(),
        }
        setVerificationStatus(verificationResult)

        if (!verificationResult.success) {
          throw new Error('Address verification failed')
        }

        return await apiClient.commitIntentConfig(args)
      } catch (error) {
        console.error('Error during verification:', error)
        throw error
      }
    },
    onSuccess: (data) => {
      console.log('Intent config committed successfully:', data)
    },
    onError: (error) => {
      console.error('Failed to commit intent config:', error)
    },
  })

  const createIntentMutation = useMutation<GetIntentOperationsReturn, Error, IntentAction>({
    mutationFn: async (action: IntentAction) => {
      if (!apiClient || !selectedToken || !account.address) {
        throw new Error('Missing API client, selected token, or account address')
      }

      const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
      const RECIPIENT_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      const AMOUNT = 30000000n // 30 USDC (6 decimals)

      // Ensure we have a valid chain ID, defaulting to Base (8453) if none provided
      const destinationChainId = selectedToken.chainId || 8453

      let destinationCall
      if (action === 'pay') {
        // ERC20 ABI functions
        const erc20Transfer = AbiFunction.from('function transfer(address,uint256) returns (bool)')
        const encodedData = AbiFunction.encodeData(erc20Transfer, [RECIPIENT_ADDRESS, AMOUNT]) as Hex

        // Ensure calldata is prefixed with 0x
        const transactionData = encodedData.startsWith('0x') ? encodedData : `0x${encodedData}`

        destinationCall = {
          chainId: 8453,
          to: USDC_ADDRESS,
          transactionData,
          transactionValue: '0',
        }
      } else if (action === 'custom_call') {
        // Handle custom call
        destinationCall = {
          chainId: parseInt(customCallData.chainId),
          to: customCallData.to,
          transactionData: customCallData.data.startsWith('0x') ? customCallData.data : `0x${customCallData.data}`,
          transactionValue: customCallData.value,
        }
      } else {
        // Ensure mock data is prefixed with 0x
        const transactionData = MOCK_TRANSFER_DATA.startsWith('0x') ? MOCK_TRANSFER_DATA : `0x${MOCK_TRANSFER_DATA}`

        destinationCall = {
          chainId: destinationChainId,
          to: USDC_ADDRESS,
          transactionData,
          transactionValue: '0',
        }
      }

      const args = {
        userAddress: account.address,
        originChainId: selectedToken.chainId || 8453,
        originTokenAddress: selectedToken.contractAddress,
        destinationChainId:
          action === 'custom_call'
            ? parseInt(customCallData.chainId)
            : action === 'mock_interaction'
              ? MOCK_CHAIN_ID
              : destinationCall.chainId,
        destinationToAddress:
          action === 'custom_call'
            ? customCallData.to
            : action === 'mock_interaction'
              ? MOCK_CONTRACT_ADDRESS
              : destinationCall.to,
        destinationTokenAddress:
          action === 'custom_call'
            ? customCallData.tokenAddress
            : action === 'mock_interaction'
              ? MOCK_TOKEN_ADDRESS
              : USDC_ADDRESS,
        destinationTokenAmount:
          action === 'custom_call'
            ? customCallData.tokenAmount
            : action === 'mock_interaction'
              ? MOCK_TOKEN_AMOUNT
              : AMOUNT.toString(),
        destinationCallData:
          action === 'custom_call'
            ? customCallData.data.startsWith('0x')
              ? customCallData.data
              : `0x${customCallData.data}`
            : action === 'mock_interaction'
              ? MOCK_TRANSFER_DATA
              : destinationCall.transactionData,
        destinationCallValue:
          action === 'custom_call'
            ? customCallData.value
            : action === 'mock_interaction'
              ? MOCK_TOKEN_AMOUNT
              : destinationCall.transactionValue,
      }

      console.log('Calling createIntentConfig with args:', args)
      return await apiClient.getIntentOperations(args)
    },
    onSuccess: (data) => {
      console.log('Intent Config Success:', data)
      if (data && data.operations && data.operations.length > 0) {
        setIntentOperations(data.operations)
        setIntentPreconditions(data.preconditions)
      } else {
        console.warn('API returned success but no operations found.')
        setIntentOperations(null)
        setIntentPreconditions(null)
      }
    },
    onError: (error) => {
      console.error('Intent Config Error:', error)
      setIntentOperations(null)
      setIntentPreconditions(null)
    },
  })

  const sortedTokens = useMemo(() => {
    if (!tokenBalancesData?.balances) {
      return []
    }

    // Flatten both native and token balances
    const nativeBalances = tokenBalancesData.nativeBalances.flatMap((b) => b.results)
    const tokenBalances = tokenBalancesData.balances.flatMap((b) => b.results)
    const balances = [...nativeBalances, ...tokenBalances]

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
    setIntentOperations(null)
    setIntentPreconditions(null)
  }, [account.address, account.chainId])

  const handleActionClick = (action: IntentAction) => {
    setIntentOperations(null)
    setIntentPreconditions(null)
    setShowCustomCallForm(false)
    if (action === 'custom_call') {
      setShowCustomCallForm(true)
    } else {
      createIntentMutation.mutate(action)
    }
  }

  const handleCustomCallSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createIntentMutation.mutate('custom_call')
    setShowCustomCallForm(false)
  }

  // Update handleSendOriginCall to track status
  const handleSendOriginCall = async () => {
    if (!intentOperations?.[0]?.calls?.[0] || !verificationStatus?.success) return

    setTxnHash(undefined) // Reset hash before sending
    updateMetaTxnStatus(undefined, 'sending') // Update UI immediately

    sendTransaction(
      {
        to: intentOperations[0].calls[0].to as `0x${string}`,
        data: intentOperations[0].calls[0].data as `0x${string}`,
        value: BigInt(intentOperations[0].calls[0].value || '0'),
        chainId: parseInt(intentOperations[0].chainId),
      },
      {
        onSuccess: (hash) => {
          console.log('Transaction sent, hash:', hash)
          setTxnHash(hash) // Set hash to trigger useWaitForTransactionReceipt
          // Status will be updated by the useEffect hook watching the receipt
        },
        onError: (error) => {
          console.error('Transaction failed:', error)
          updateMetaTxnStatus(undefined, 'reverted', undefined, undefined, error.message)
        },
      },
    )
  }

  // Hook to wait for transaction receipt
  const {
    data: receipt,
    isLoading: isWaitingForReceipt,
    isSuccess,
    isError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txnHash,
    confirmations: 1,
    query: {
      enabled: !!txnHash,
    },
  })

  // Effect to update status based on receipt
  useEffect(() => {
    if (!txnHash) {
      // No transaction sent yet or reset
      setMetaTxnStatus(null) // Clear status
      return
    }
    if (isWaitingForReceipt) {
      updateMetaTxnStatus(txnHash, 'pending')
      return
    }
    if (isSuccess && receipt) {
      updateMetaTxnStatus(receipt.transactionHash, receipt.status, receipt.gasUsed, receipt.effectiveGasPrice)
      // Optionally, trigger relayer status check here if needed after confirmation
      // e.g., checkPreconditionStatuses()
    } else if (isError) {
      console.error('Error waiting for receipt:', receiptError)
      updateMetaTxnStatus(txnHash, 'reverted', undefined, undefined, receiptError?.message || 'Failed to get receipt')
    }
  }, [isWaitingForReceipt, isSuccess, isError, receipt, txnHash, receiptError])

  // Add useEffect to check precondition statuses when intentPreconditions changes
  useEffect(() => {
    if (intentPreconditions) {
      checkPreconditionStatuses()
    }
  }, [intentPreconditions, checkPreconditionStatuses])

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
              {sortedTokens.map((token) => {
                const isNative = !('contractAddress' in token)
                const tokenBalance = isNative ? undefined : (token as TokenBalance)
                const chainInfo = getChainInfo(token.chainId)
                const nativeSymbol = chainInfo?.nativeCurrency.symbol || 'ETH' // Default to ETH if chain not found

                return (
                  <div
                    key={
                      isNative
                        ? `${token.chainId}-native`
                        : `${tokenBalance?.chainId}-${tokenBalance?.contractAddress}-${tokenBalance?.tokenID ?? '0'}`
                    }
                    onClick={() => {
                      if (isNative) {
                        setSelectedToken({
                          ...token,
                          contractAddress: zeroAddress,
                          contractType: 'ERC20',
                          contractInfo: {
                            name: chainInfo?.nativeCurrency.name || 'Native Token',
                            symbol: chainInfo?.nativeCurrency.symbol || 'ETH',
                            decimals: 18,
                          },
                          blockHash: '',
                          blockNumber: 0,
                          uniqueCollectibles: [],
                          isSummary: true,
                        } as unknown as TokenBalance)
                      } else {
                        setSelectedToken(token)
                      }
                      setIntentOperations(null)
                      setIntentPreconditions(null)
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex justify-between items-center ${selectedToken?.chainId === token.chainId && (isNative ? selectedToken?.contractAddress === zeroAddress : selectedToken?.contractAddress === token.contractAddress) ? 'bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 shadow-lg' : 'bg-gray-700/80 hover:bg-gray-600/90 hover:shadow-md'}`}
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
                    <span>
                      Pay Action{' '}
                      <Text variant="small" color="secondary">
                        (0.03 USDC to Vitalik)
                      </Text>
                    </span>
                  </>
                )}
              </Button>
              <Button
                variant="raised"
                onClick={() => handleActionClick('mock_interaction')}
                disabled={!selectedToken || createIntentMutation.isPending}
                className="px-5 py-2.5 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
              >
                {createIntentMutation.isPending && createIntentMutation.variables === 'mock_interaction' ? (
                  'Processing...'
                ) : (
                  <>
                    <NetworkImage chainId={chains.arbitrum.id} size="sm" className="w-5 h-5" />
                    <span>Mock Interaction</span>
                  </>
                )}
              </Button>
              <Button
                variant="feature"
                onClick={() => handleActionClick('custom_call')}
                disabled={!selectedToken || createIntentMutation.isPending}
                className="px-5 py-2.5 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
              >
                {createIntentMutation.isPending && createIntentMutation.variables === 'custom_call' ? (
                  'Processing...'
                ) : (
                  <div className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <span>Custom Call</span>
                  </div>
                )}
              </Button>
            </div>

            {showCustomCallForm && (
              <div className="mt-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700/30">
                <form onSubmit={handleCustomCallSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">To Address</label>
                    <input
                      type="text"
                      value={customCallData.to}
                      onChange={(e) => setCustomCallData({ ...customCallData, to: e.target.value })}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Call Data</label>
                    <input
                      type="text"
                      value={customCallData.data}
                      onChange={(e) => setCustomCallData({ ...customCallData, data: e.target.value })}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Value (in wei)</label>
                    <input
                      type="text"
                      value={customCallData.value}
                      onChange={(e) => setCustomCallData({ ...customCallData, value: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Destination Chain ID</label>
                    <input
                      type="text"
                      value={customCallData.chainId}
                      onChange={(e) => setCustomCallData({ ...customCallData, chainId: e.target.value })}
                      placeholder="8453"
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Token Amount (in wei)</label>
                    <input
                      type="text"
                      value={customCallData.tokenAmount}
                      onChange={(e) => setCustomCallData({ ...customCallData, tokenAmount: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Token Address</label>
                    <input
                      type="text"
                      value={customCallData.tokenAddress}
                      onChange={(e) => setCustomCallData({ ...customCallData, tokenAddress: e.target.value })}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setShowCustomCallForm(false)}
                      className="px-4 py-2"
                    >
                      Cancel
                    </Button>
                    <Button variant="primary" size="small" type="submit" className="px-4 py-2">
                      Submit
                    </Button>
                  </div>
                </form>
              </div>
            )}

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
            {intentOperations && (
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
                  Intent Operations
                  <Text variant="small" color="secondary" className="ml-1">
                    (List of operations that are pre-authorized to be executed):
                  </Text>
                </Text>
                {intentOperations &&
                intentOperations.length > 0 &&
                intentOperations[0].calls &&
                intentOperations[0].calls.length > 0 ? (
                  <>
                    <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                      <Text variant="small" color="secondary">
                        <strong className="text-blue-300">To: </strong>{' '}
                        <span className="text-yellow-300 break-all font-mono">{intentOperations[0].calls[0].to}</span>
                      </Text>
                    </div>
                    <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                      <Text variant="small" color="secondary">
                        <strong className="text-blue-300">Value: </strong>
                        <span className="font-mono">{intentOperations[0].calls[0].value || '0'}</span>
                      </Text>
                    </div>
                    <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                      <Text variant="small" color="secondary" className="break-all">
                        <strong className="text-blue-300">Data: </strong>
                        <span className="font-mono text-green-300">{intentOperations[0].calls[0].data || '0x'}</span>
                      </Text>
                    </div>
                    <div className="bg-gray-800/70 p-2 rounded-md mb-1 flex items-center">
                      <Text variant="small" color="secondary">
                        <strong className="text-blue-300">Chain ID: </strong>
                        <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded-full">
                          {intentOperations[0].chainId}
                        </span>
                      </Text>
                      <NetworkImage
                        chainId={parseInt(intentOperations[0].chainId)}
                        size="sm"
                        className="w-4 h-4 ml-1"
                      />
                      <Text variant="small" color="secondary" className="ml-1">
                        {getChainInfo(parseInt(intentOperations[0].chainId))?.name || 'Unknown Chain'}
                      </Text>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-800/70 p-3 rounded-md border border-gray-700/50">
                    <Text variant="small" color="secondary">
                      No origin call details available.
                    </Text>
                  </div>
                )}

                {intentPreconditions && intentPreconditions.length > 0 && (
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
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2"
                        />
                      </svg>
                      Preconditions
                      <Text variant="small" color="secondary" className="ml-1">
                        (Conditions that are to be met for the intent to be executed):
                      </Text>
                    </Text>
                    <ul className="space-y-2 pl-2">
                      {intentPreconditions.map((cond: any, index: number) => (
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
                {!intentPreconditions?.length && (
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

            {!createIntentMutation.isPending && !createIntentMutation.isError && !intentOperations && (
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

          {/* 4. Commit Intent */}
          {intentOperations && intentPreconditions && (
            <div>
              <div className="flex items-center mb-4">
                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                  <span>4</span>
                </div>
                <h3 className="text-xl font-semibold text-white">Commit Intent</h3>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/30">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Commit Intent
                      <Text variant="small" color="secondary" className="ml-1">
                        (Verify and Send Transaction)
                      </Text>
                    </Text>
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!account.address || !intentOperations || !intentPreconditions) return
                        commitIntentConfigMutation.mutate({
                          walletAddress: account.address,
                          mainSigner: account.address,
                          operations: intentOperations,
                          preconditions: intentPreconditions,
                        })
                      }}
                      disabled={commitIntentConfigMutation.isPending}
                      className="px-5 py-2.5 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {commitIntentConfigMutation.isPending ? (
                        <div className="flex items-center">
                          <svg
                            className="animate-spin h-4 w-4 mr-2"
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
                          Committing...
                        </div>
                      ) : (
                        'Commit Intent'
                      )}
                    </Button>
                  </div>
                  {commitIntentConfigMutation.isError && (
                    <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                      <Text variant="small" color="white">
                        Error: {commitIntentConfigMutation.error.message}
                      </Text>
                    </div>
                  )}
                  {commitIntentConfigMutation.isSuccess && (
                    <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                      <Text variant="small" color="success">
                        Intent configuration committed successfully!
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Verification Banner */}
          {verificationStatus && (
            <div
              className={`mt-4 p-4 rounded-lg border ${
                verificationStatus.success ? 'bg-green-900/20 border-green-700/30' : 'bg-red-900/20 border-red-700/30'
              }`}
            >
              <div className="flex items-center">
                {verificationStatus.success ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-400 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-red-400 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <div>
                  <Text variant="small" color={verificationStatus.success ? 'success' : 'white'}>
                    {verificationStatus.success ? 'Verification Successful' : 'Verification Failed'}
                  </Text>
                  <div className="mt-1 text-xs text-gray-400">
                    <div>Received: {verificationStatus.receivedAddress}</div>
                    <div>Calculated: {verificationStatus.calculatedAddress}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Origin Call */}
          {intentOperations && intentPreconditions && (
            <div>
              <div className="flex items-center mb-4">
                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                  <span>5</span>
                </div>
                <h3 className="text-xl font-semibold text-white">Origin Call</h3>
              </div>
              <div className="text-xs text-gray-300 bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
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
                  Transaction Details
                  <Text variant="small" color="secondary" className="ml-1">
                    (Send this transaction to execute the intent):
                  </Text>
                </Text>
                <div className="space-y-2">
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">From: </strong>
                      <span className="text-yellow-300 break-all font-mono">{account.address}</span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">To: </strong>
                      <span className="text-yellow-300 break-all font-mono">{intentOperations[0].calls[0].to}</span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Value: </strong>
                      <span className="font-mono">{intentOperations[0].calls[0].value || '0'}</span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary" className="break-all">
                      <strong className="text-blue-300">Data: </strong>
                      <span className="font-mono text-green-300">{intentOperations[0].calls[0].data || '0x'}</span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md flex items-center">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Chain ID: </strong>
                      <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded-full">
                        {intentOperations[0].chainId}
                      </span>
                    </Text>
                    <NetworkImage chainId={parseInt(intentOperations[0].chainId)} size="sm" className="w-4 h-4 ml-1" />
                    <Text variant="small" color="secondary" className="ml-1">
                      {getChainInfo(parseInt(intentOperations[0].chainId))?.name || 'Unknown Chain'}
                    </Text>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="primary"
                      onClick={handleSendOriginCall}
                      disabled={!verificationStatus?.success || isSendingTransaction}
                      className="px-5 py-2.5 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {isSendingTransaction ? (
                        <div className="flex items-center">
                          <svg
                            className="animate-spin h-4 w-4 mr-2"
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
                          Sending...
                        </div>
                      ) : (
                        'Send Transaction'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. Relayer Status */}
          {intentOperations && intentPreconditions && (
            <div>
              <div className="flex items-center mb-4">
                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                  <span>6</span>
                </div>
                <h3 className="text-xl font-semibold text-white">Relayer Status</h3>
              </div>
              <div className="text-xs text-gray-300 bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Meta Transaction Status
                  <Text variant="small" color="secondary" className="ml-1">
                    (Track the status of your meta transaction)
                  </Text>
                </Text>
                <div className="space-y-2">
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Transaction Hash: </strong>
                      <span className="text-yellow-300 break-all font-mono">
                        {metaTxnStatus?.txnHash || 'Not sent yet'}
                      </span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Status: </strong>
                      <span
                        className={`font-mono ${
                          metaTxnStatus?.status === 'Success'
                            ? 'text-green-400'
                            : metaTxnStatus?.status === 'Failed'
                              ? 'text-red-400'
                              : metaTxnStatus?.status === 'Pending' || metaTxnStatus?.status === 'Sending...'
                                ? 'text-yellow-400'
                                : 'text-gray-400' // Idle or default
                        }`}
                      >
                        {metaTxnStatus?.status || 'Idle'}
                      </span>
                      {isWaitingForReceipt && (
                        <span className="text-yellow-400 ml-1">(Waiting for confirmation...)</span>
                      )}
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary" className="break-all">
                      <strong className="text-blue-300">Revert Reason: </strong>
                      <span className="font-mono text-red-300">{metaTxnStatus?.revertReason || 'None'}</span>
                    </Text>
                  </div>
                </div>

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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Preconditions Status
                  <Text variant="small" color="secondary" className="ml-1">
                    (Check if all preconditions are met)
                  </Text>
                </Text>
                <div className="space-y-2">
                  {intentPreconditions.map((precondition, index) => (
                    <div key={index} className="bg-gray-800/70 p-2 rounded-md">
                      <Text variant="small" color="secondary">
                        <strong className="text-blue-300">
                          Precondition {index + 1} ({precondition.type}):{' '}
                        </strong>
                        <span className="font-mono">
                          {preconditionStatuses[index] ? (
                            <span className="text-green-400">Met</span>
                          ) : (
                            <span className="text-red-400">Not Met</span>
                          )}
                        </span>
                      </Text>
                    </div>
                  ))}
                </div>

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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Final Intent Status
                  <Text variant="small" color="secondary" className="ml-1">
                    (Overall status of the intent execution)
                  </Text>
                </Text>
                <div className="space-y-2">
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Status: </strong>
                      <span className="font-mono">{metaTxnStatus?.status || 'Pending'}</span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Gas Used: </strong>
                      <span className="font-mono">{metaTxnStatus?.gasUsed || '0'}</span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Effective Gas Price: </strong>
                      <span className="font-mono">{metaTxnStatus?.effectiveGasPrice || '0'}</span>
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
