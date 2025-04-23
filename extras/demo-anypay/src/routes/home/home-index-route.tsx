import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect, useSendTransaction, useSwitchChain } from 'wagmi'
import { Connector } from 'wagmi'
import { NativeTokenBalance, TokenBalance } from '@0xsequence/indexer'
import { GetIntentOperationsReturn, IntentOperation, IntentPrecondition, GetIntentConfigReturn } from '@0xsequence/api'
import { formatUnits, Hex, isAddressEqual, zeroAddress } from 'viem'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAPIClient } from '@/hooks/useAPIClient'
import { Button, Text, NetworkImage } from '@0xsequence/design-system'
import { AbiFunction, Address, Bytes } from 'ox'
import * as chains from 'viem/chains'
import { AnyPay } from '@0xsequence/wallet-core'
import { Context as ContextLike } from '@0xsequence/wallet-primitives'
import { useWaitForTransactionReceipt } from 'wagmi'
import { useMetaTxnMonitor } from '@/hooks/useMetaTxnMonitor'
import { useRelayers } from '@/hooks/useRelayers'
import {
  AlertTriangle,
  Loader2,
  Zap,
  Info,
  Clipboard,
  Box,
  AlertCircle,
  Layers,
  PenSquare,
  ShieldCheck,
} from 'lucide-react'
import { useTokenBalances } from '@/hooks/useTokenBalances'

// Helper to get chain info
const getChainInfo = (chainId: number) => {
  return Object.values(chains).find((chain) => chain.id === chainId) || null
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

// Add type for calculated origin call parameters
type OriginCallParams = {
  to: `0x${string}` | null
  data: Hex | null
  value: bigint | null
  chainId: number | null
  error?: string
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

const findPreconditionAddress = (preconditions: IntentPrecondition[]) => {
  const preconditionTypes = ['erc20-balance', 'native-balance'] as const

  for (const type of preconditionTypes) {
    const precondition = preconditions.find((p) => p.type === type && p.data?.address)
    if (precondition) {
      return precondition.data.address
    }
  }

  return `N/A (No ${preconditionTypes.join(' or ')} precondition with address found)`
}

export const HomeIndexRoute = () => {
  const account = useAccount()
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { sendTransaction, isPending: isSendingTransaction } = useSendTransaction()
  const { switchChain, isPending: isSwitchingChain, error: switchChainError } = useSwitchChain()
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

  const apiClient = useAPIClient()

  // State declarations
  const [metaTxns, setMetaTxns] = useState<GetIntentOperationsReturn['metaTxns'] | null>(null)
  const [intentOperations, setIntentOperations] = useState<GetIntentOperationsReturn['operations'] | null>(null)
  const [intentPreconditions, setIntentPreconditions] = useState<GetIntentOperationsReturn['preconditions'] | null>(
    null,
  )
  const [txnHash, setTxnHash] = useState<Hex | undefined>()
  const [committedIntentAddress, setCommittedIntentAddress] = useState<string | null>(null)
  const [preconditionStatuses, setPreconditionStatuses] = useState<boolean[]>([])
  const [verificationStatus, setVerificationStatus] = useState<{
    success: boolean
    receivedAddress?: string
    calculatedAddress?: string
  } | null>(null)
  const [metaTxnStatus, setMetaTxnStatus] = useState<{
    txnHash?: string
    status?: string
    revertReason?: string
    gasUsed?: number
    effectiveGasPrice?: string
  } | null>(null)
  const [originCallParams, setOriginCallParams] = useState<OriginCallParams | null>(null)
  const [isChainSwitchRequired, setIsChainSwitchRequired] = useState(false)
  const [isAutoExecuteEnabled, setIsAutoExecuteEnabled] = useState(true)
  const [operationStatuses, setOperationStatuses] = useState<{
    [key: string]: {
      status: 'pending' | 'success' | 'failed'
      txHash?: string
      error?: string
      preconditionsMet?: boolean
      lastPreconditionCheck?: string
    }
  }>({})
  const [operationHashes, setOperationHashes] = useState<{ [key: string]: Hex }>({})
  const [isTransactionInProgress, setIsTransactionInProgress] = useState(false)
  const { sortedTokens, isLoadingBalances, balanceError } = useTokenBalances(account.address as Address.Address)

  // Track timestamps of when each meta-transaction was last sent
  const [sentMetaTxns, setSentMetaTxns] = useState<{ [key: string]: number }>({})

  const RETRY_WINDOW_MS = 10_000

  const { getRelayer } = useRelayers()

  const calculateIntentAddress = useCallback((operations: IntentOperation[], mainSigner: string) => {
    try {
      const context: ContextLike.Context = {
        factory: '0x4B755c6A321C86bD35bBbb5CD56321FE48b51d1e' as `0x${string}`,
        stage1: '0x006FFf4932D4ad20aacD34E5Cc6CCf0644cbB099' as `0x${string}`,
        creationCode:
          '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as `0x${string}`,
      }

      const coreOperations = operations.map((op) => ({
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

      return AnyPay.calculateIntentConfigurationAddress(coreOperations, Address.from(mainSigner), context)
    } catch (error) {
      console.error('Error calculating intent address:', error)
      throw error
    }
  }, [])

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

  const checkPreconditionStatuses = useCallback(async () => {
    if (!intentPreconditions) return

    const statuses = await Promise.all(
      intentPreconditions.map(async (precondition) => {
        try {
          const chainIdString = precondition.chainId
          if (!chainIdString) {
            console.warn('Precondition missing chainId:', precondition)
            return false
          }
          const chainId = parseInt(chainIdString)
          if (isNaN(chainId) || chainId <= 0) {
            console.warn('Precondition has invalid chainId:', chainIdString, precondition)
            return false
          }

          const chainRelayer = getRelayer(chainId)
          if (!chainRelayer) {
            console.error(`No relayer found for chainId: ${chainId}`)
            return false
          }

          return await chainRelayer.checkPrecondition(precondition)
        } catch (error) {
          console.error('Error checking precondition:', error, 'Precondition:', precondition)
          return false
        }
      }),
    )

    setPreconditionStatuses(statuses)
  }, [intentPreconditions, getRelayer])

  useEffect(() => {
    // TODO: Remove this once we have a way to check precondition statuses
    if (false) {
      checkPreconditionStatuses()
    }
  }, [intentPreconditions, checkPreconditionStatuses])

  const commitIntentConfigMutation = useMutation({
    mutationFn: async (args: {
      walletAddress: string
      mainSigner: string
      operations: IntentOperation[]
      preconditions: IntentPrecondition[]
    }) => {
      if (!apiClient) throw new Error('API client not available')
      if (!account.address) throw new Error('Account address not available')

      try {
        const calculatedAddress = calculateIntentAddress(args.operations, args.mainSigner)
        const receivedAddress = findPreconditionAddress(args.preconditions)

        const isVerified = isAddressEqual(Address.from(receivedAddress), calculatedAddress)
        setVerificationStatus({
          success: isVerified,
          receivedAddress: receivedAddress,
          calculatedAddress: calculatedAddress.toString(),
        })

        if (!isVerified) {
          throw new Error('Address verification failed: Calculated address does not match received address.')
        }

        // Commit the intent config
        const response = await apiClient.commitIntentConfig({
          walletAddress: calculatedAddress.toString(),
          mainSigner: args.mainSigner,
          operations: args.operations,
          preconditions: args.preconditions,
        })
        console.log('API Commit Response:', response)
        return { calculatedAddress: calculatedAddress.toString(), response }
      } catch (error) {
        console.error('Error during commit intent mutation:', error)
        if (!verificationStatus?.success && !verificationStatus?.receivedAddress) {
          try {
            const calculatedAddress = calculateIntentAddress(args.operations, args.mainSigner)
            const receivedAddress = findPreconditionAddress(args.preconditions)
            setVerificationStatus({
              success: false,
              receivedAddress: receivedAddress,
              calculatedAddress: calculatedAddress.toString(),
            })
          } catch (calcError) {
            console.error('Error calculating addresses for verification status on failure:', calcError)
            setVerificationStatus({ success: false })
          }
        }
        throw error
      }
    },
    onSuccess: (data) => {
      console.log('Intent config committed successfully, Wallet Address:', data.calculatedAddress)
      setCommittedIntentAddress(data.calculatedAddress)
    },
    onError: (error) => {
      console.error('Failed to commit intent config:', error)
      setCommittedIntentAddress(null)
    },
  })

  // New Query to fetch committed intent config
  const {
    data: committedIntentConfig,
    isLoading: isLoadingCommittedConfig,
    error: committedConfigError,
  } = useQuery<GetIntentConfigReturn, Error>({
    queryKey: ['getIntentConfig', committedIntentAddress],
    queryFn: async () => {
      if (!apiClient || !committedIntentAddress) {
        throw new Error('API client or committed intent address not available')
      }
      console.log('Fetching intent config for address:', committedIntentAddress)
      return await apiClient.getIntentConfig({ walletAddress: committedIntentAddress })
    },
    enabled: !!committedIntentAddress && !!apiClient && commitIntentConfigMutation.isSuccess,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

  const createIntentMutation = useMutation<GetIntentOperationsReturn, Error, IntentAction>({
    mutationFn: async (action: IntentAction) => {
      if (!apiClient || !selectedToken || !account.address) {
        throw new Error('Missing API client, selected token, or account address')
      }
      // Reset commit state when generating a new intent
      setCommittedIntentAddress(null)
      setVerificationStatus(null)

      const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
      const RECIPIENT_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      const AMOUNT = 30000n // 0.03 USDC (6 decimals)

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

      const data = await apiClient.getIntentOperations(args)

      setMetaTxns(data.metaTxns)
      setIntentOperations(data.operations)
      setIntentPreconditions(data.preconditions)
      setCommittedIntentAddress(null)
      setVerificationStatus(null)
      return data
    },
    onSuccess: (data) => {
      console.log('Intent Config Success:', data)
      if (
        data &&
        data.operations &&
        data.operations.length > 0 &&
        data.preconditions &&
        data.preconditions.length > 0 &&
        data.metaTxns &&
        data.metaTxns.length > 0
      ) {
        setIntentOperations(data.operations)
        setIntentPreconditions(data.preconditions)
        setMetaTxns(data.metaTxns)
      } else {
        console.warn('API returned success but no operations found.')
        setIntentOperations(null)
        setIntentPreconditions(null)
        setMetaTxns(null)
      }
    },
    onError: (error) => {
      console.error('Intent Config Error:', error)
      setIntentOperations(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
    },
  })

  useEffect(() => {
    if (!account.isConnected) {
      setSelectedToken(null)
      setIntentOperations(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
      setCommittedIntentAddress(null)
      setVerificationStatus(null)
    }
  }, [account.isConnected])

  const handleActionClick = (action: IntentAction) => {
    setIntentOperations(null)
    setIntentPreconditions(null)
    setMetaTxns(null)
    setShowCustomCallForm(false)
    setCommittedIntentAddress(null)
    setVerificationStatus(null)
    setOperationStatuses({})
    setOperationHashes({})
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

  const handleSendOriginCall = async () => {
    if (
      isTransactionInProgress || // Prevent duplicate transactions
      !originCallParams ||
      originCallParams.error ||
      !originCallParams.to ||
      originCallParams.data === null ||
      originCallParams.value === null ||
      originCallParams.chainId === null
    ) {
      console.error('Origin call parameters not available or invalid:', originCallParams)
      updateMetaTxnStatus(undefined, 'reverted', undefined, undefined, 'Origin call parameters not ready')
      return
    }

    // Check if we need to switch chains
    if (account.chainId !== originCallParams.chainId) {
      setIsChainSwitchRequired(true)
      updateMetaTxnStatus(
        undefined,
        'pending',
        undefined,
        undefined,
        `Switching to chain ${originCallParams.chainId}...`,
      )

      try {
        console.log('Switching to chain:', originCallParams.chainId)

        await switchChain({ chainId: originCallParams.chainId })
      } catch (error: any) {
        console.error('Failed to switch chain:', error)
        if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
          setIsAutoExecuteEnabled(false)
        }
        updateMetaTxnStatus(
          undefined,
          'reverted',
          undefined,
          undefined,
          `Failed to switch chain: ${error.message || 'Unknown error'}`,
        )
        setIsChainSwitchRequired(false)
      }
      return // Stop execution here whether switch succeeded or failed.
    }

    // Ensure only one transaction is sent at a time
    if (!isTransactionInProgress) {
      setIsTransactionInProgress(true) // Mark transaction as in progress
      setTxnHash(undefined)
      updateMetaTxnStatus(undefined, 'sending')

      sendTransaction(
        {
          to: originCallParams.to,
          data: originCallParams.data,
          value: originCallParams.value,
          chainId: originCallParams.chainId,
        },
        {
          onSuccess: (hash) => {
            console.log('Transaction sent, hash:', hash)
            setTxnHash(hash)
            setIsTransactionInProgress(false) // Reset transaction state
          },
          onError: (error) => {
            console.error('Transaction failed:', error)
            if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
              setIsAutoExecuteEnabled(false)
            }
            updateMetaTxnStatus(undefined, 'reverted', undefined, undefined, error.message)
            setIsTransactionInProgress(false)
          },
        },
      )
    } else {
      console.warn('Transaction already in progress. Skipping duplicate request.')
    }
  }

  // Remove the chain change effect that might be resetting state
  useEffect(() => {
    if (switchChainError) {
      console.error('Chain switch error:', switchChainError)
      updateMetaTxnStatus(
        undefined,
        'reverted',
        undefined,
        undefined,
        `Chain switch failed: ${switchChainError.message || 'Unknown error'}`,
      )
      setIsChainSwitchRequired(false)
    }
  }, [switchChainError])

  // Effect to handle auto-execution after chain switch
  useEffect(() => {
    if (isAutoExecuteEnabled && originCallParams?.chainId && account.chainId === originCallParams.chainId) {
      // Chain has been switched successfully, now send the transaction
      if (!originCallParams.to || !originCallParams.data || originCallParams.value === null) {
        console.error('Invalid origin call parameters for auto-execution')
        return
      }

      sendTransaction(
        {
          to: originCallParams.to,
          data: originCallParams.data,
          value: originCallParams.value,
          chainId: originCallParams.chainId,
        },
        {
          onSuccess: (hash) => {
            console.log('Auto-executed transaction sent, hash:', hash)
            setTxnHash(hash)
          },
          onError: (error) => {
            console.error('Auto-executed transaction failed:', error)
            updateMetaTxnStatus(undefined, 'reverted', undefined, undefined, error.message)
          },
        },
      )
    }
  }, [isAutoExecuteEnabled, originCallParams?.chainId, account.chainId])

  // Only update chain switch required state when needed
  useEffect(() => {
    if (originCallParams?.chainId && account.chainId === originCallParams.chainId) {
      setIsChainSwitchRequired(false)
    }
  }, [account.chainId, originCallParams?.chainId])

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

  useEffect(() => {
    if (!txnHash) {
      setMetaTxnStatus(null)
      setSentMetaTxns({})
      return
    }
    if (isWaitingForReceipt) {
      updateMetaTxnStatus(txnHash, 'pending')
      return
    }
    if (isSuccess && receipt) {
      updateMetaTxnStatus(receipt.transactionHash, receipt.status, receipt.gasUsed, receipt.effectiveGasPrice)

      // After origin call is confirmed, send the meta-transaction
      const sendMetaTxn = async () => {
        if (!intentOperations || !intentPreconditions || !metaTxns || !account.address) {
          console.error('Missing required data for meta-transaction')
          return
        }

        try {
          // Calculate the intent address
          const intentAddress = calculateIntentAddress(intentOperations, account.address)

          // For each operation, send the meta-transaction using the appropriate relayer
          for (const operation of intentOperations) {
            const operationKey = `${operation.chainId}-${intentOperations.indexOf(operation)}`
            const lastSentTime = sentMetaTxns[operationKey]
            const now = Date.now()

            // Skip if this meta transaction has been sent within the retry window
            if (lastSentTime && now - lastSentTime < RETRY_WINDOW_MS) {
              const timeLeft = Math.ceil((RETRY_WINDOW_MS - (now - lastSentTime)) / 1000)
              console.log(
                `Meta transaction for operation ${operationKey} was sent recently. Wait ${timeLeft}s before retry`,
              )
              continue
            }

            try {
              const chainId = parseInt(operation.chainId)
              if (isNaN(chainId) || chainId <= 0) {
                throw new Error(`Invalid chainId for operation: ${operation.chainId}`)
              }
              const chainRelayer = getRelayer(chainId)
              if (!chainRelayer) {
                throw new Error(`No relayer found for chainId: ${chainId}`)
              }

              // Get the matching meta-transaction from metaTxns
              const metaTxn = metaTxns.find((m) => parseInt(m.chainId) === chainId)
              if (!metaTxn) {
                throw new Error(`No meta-transaction found for chainId: ${chainId}`)
              }

              // Get the relevant preconditions for the operation
              const relevantPreconditions = intentPreconditions.filter(
                (p) => p.chainId && parseInt(p.chainId) === chainId,
              )

              console.log(
                `Relaying operation ${operationKey} to intent ${intentAddress} on chain ${chainId} via relayer:`,
                chainRelayer,
              )
              console.log(`Relay data:`, {
                intentAddress,
                metaTxns,
                chainId,
                relevantPreconditions,
              })

              // Send the meta-transaction through the chain-specific relayer
              const { opHash } = await chainRelayer.relay(
                metaTxn?.contract as Address.Address,
                metaTxn?.input as Hex,
                BigInt(operation.chainId),
                undefined,
                relevantPreconditions,
              )

              // Record the timestamp when this meta transaction was sent
              setSentMetaTxns((prev) => ({
                ...prev,
                [operationKey]: Date.now(),
              }))

              // Store the opHash in state for monitoring
              setOperationHashes((prev) => ({
                ...prev,
                [operationKey]: opHash,
              }))
              // Update status to pending after successful relay initiation (monitoring will update further)
              setOperationStatuses((prev) => ({
                ...prev,
                [operationKey]: { ...prev[operationKey], status: 'pending', error: undefined },
              }))
            } catch (error: any) {
              console.error(`Error sending meta-transaction for operation ${operationKey}:`, error)
              // Log additional details if available
              if (error.cause) {
                console.error(`Caused by:`, error.cause)
              }
              if (error.message.includes('fetch')) {
                console.error(
                  `Fetch error details: Might be network issue, CORS, or invalid relayer URL for chain ${operation.chainId}`,
                )
              }
              // Don't update the timestamp on error - this allows immediate retry on error
              setOperationStatuses((prev) => ({
                ...prev,
                [operationKey]: {
                  status: 'failed',
                  error: `Relay failed: ${error.message}`,
                },
              }))
            }
          }
        } catch (error: any) {
          console.error('Error in meta-transaction process:', error)
        }
      }

      // Execute the meta-transaction sending process
      sendMetaTxn()
    } else if (isError) {
      console.error('Error waiting for receipt:', receiptError)
      updateMetaTxnStatus(txnHash, 'reverted', undefined, undefined, receiptError?.message || 'Failed to get receipt')
    }
  }, [
    isWaitingForReceipt,
    isSuccess,
    isError,
    receipt,
    txnHash,
    receiptError,
    intentOperations,
    intentPreconditions,
    account.address,
    getRelayer,
    sentMetaTxns,
    metaTxns,
  ])

  useEffect(() => {
    if (!intentOperations?.[0]?.chainId || !selectedToken || !intentPreconditions || !account.address) {
      setOriginCallParams(null)
      return
    }

    try {
      const intentAddress = calculateIntentAddress(intentOperations, account.address)
      const intentAddressString = intentAddress.toString() as Address.Address

      let calcTo: Address.Address
      let calcData: Hex = '0x'
      let calcValue: bigint = 0n
      const originChainId: number = selectedToken.chainId

      const recipientAddress = intentAddressString

      const isNative = selectedToken.contractAddress === zeroAddress

      if (isNative) {
        const nativePrecondition = intentPreconditions.find(
          (p) =>
            (p.type === 'transfer-native' || p.type === 'native-balance') && p.chainId === originChainId.toString(),
        )
        const nativeMinAmount = nativePrecondition?.data?.minAmount ?? nativePrecondition?.data?.min
        if (nativeMinAmount === undefined) {
          throw new Error('Could not find native precondition (transfer-native or native-balance) or min amount')
        }
        calcValue = BigInt(nativeMinAmount)
        calcTo = recipientAddress
      } else {
        const erc20Precondition = intentPreconditions.find(
          (p) =>
            p.type === 'erc20-balance' &&
            p.chainId === originChainId.toString() &&
            p.data?.token &&
            isAddressEqual(Address.from(p.data.token), Address.from(selectedToken.contractAddress)),
        )

        const erc20MinAmount = erc20Precondition?.data?.min
        if (erc20MinAmount === undefined) {
          throw new Error('Could not find ERC20 balance precondition or min amount')
        }
        const erc20Transfer = AbiFunction.from('function transfer(address,uint256) returns (bool)')
        calcData = AbiFunction.encodeData(erc20Transfer, [recipientAddress, BigInt(erc20MinAmount)]) as Hex
        calcTo = selectedToken.contractAddress as Address.Address
      }

      setOriginCallParams({
        to: calcTo,
        data: calcData,
        value: calcValue,
        chainId: originChainId,
        error: undefined,
      })
    } catch (error: any) {
      console.error('Failed to calculate origin call params for UI:', error)
      setOriginCallParams({ to: null, data: null, value: null, chainId: null, error: error.message })
    }
  }, [intentOperations, selectedToken, intentPreconditions, account.address, calculateIntentAddress])

  useEffect(() => {
    // Auto-execute effect for handling chain switch and transaction
    if (
      isAutoExecuteEnabled &&
      originCallParams &&
      !originCallParams.error &&
      account.chainId !== originCallParams.chainId
    ) {
      handleSendOriginCall()
    }
  }, [isAutoExecuteEnabled, originCallParams, account.chainId])

  // Effect to auto-commit when intent operations are ready
  useEffect(() => {
    if (
      isAutoExecuteEnabled &&
      intentOperations &&
      intentPreconditions &&
      account.address &&
      !commitIntentConfigMutation.isPending &&
      !commitIntentConfigMutation.isSuccess
    ) {
      console.log('Auto-committing intent configuration...')
      commitIntentConfigMutation.mutate({
        walletAddress: calculateIntentAddress(intentOperations, account.address).toString(),
        mainSigner: account.address,
        operations: intentOperations,
        preconditions: intentPreconditions,
      })
    }
  }, [
    isAutoExecuteEnabled,
    intentOperations,
    intentPreconditions,
    account.address,
    commitIntentConfigMutation.isPending,
    commitIntentConfigMutation.isSuccess,
  ])

  useEffect(() => {
    if (
      isAutoExecuteEnabled &&
      originCallParams &&
      !originCallParams.error &&
      account.chainId !== originCallParams.chainId
    ) {
      handleSendOriginCall()
    }
  }, [isAutoExecuteEnabled, originCallParams, account.chainId])

  useEffect(() => {
    const shouldAutoSend =
      isAutoExecuteEnabled &&
      commitIntentConfigMutation.isSuccess &&
      originCallParams?.chainId &&
      account.chainId === originCallParams.chainId &&
      !originCallParams.error &&
      originCallParams.to &&
      originCallParams.data !== null &&
      originCallParams.value !== null &&
      !isSendingTransaction &&
      !isWaitingForReceipt &&
      !txnHash &&
      !isChainSwitchRequired

    if (shouldAutoSend) {
      console.log('Auto-executing transaction: All conditions met.')
      updateMetaTxnStatus(undefined, 'sending')

      sendTransaction(
        {
          to: originCallParams.to!,
          data: originCallParams.data!,
          value: originCallParams.value!,
          chainId: originCallParams.chainId!,
        },
        {
          onSuccess: (hash) => {
            console.log('Auto-executed transaction sent, hash:', hash)
            setTxnHash(hash)
          },
          onError: (error) => {
            console.error('Auto-executed transaction failed:', error)
            if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
              setIsAutoExecuteEnabled(false)
            }
            updateMetaTxnStatus(undefined, 'reverted', undefined, undefined, error.message)
          },
        },
      )
    }
    // Update dependencies to include commit success status
  }, [
    isAutoExecuteEnabled,
    commitIntentConfigMutation.isSuccess,
    originCallParams,
    account.chainId,
    isSendingTransaction,
    isWaitingForReceipt,
    txnHash,
    isChainSwitchRequired,
    sendTransaction,
  ])

  // Update button text and disabled state for commit button
  const commitButtonText = commitIntentConfigMutation.isPending ? (
    <div className="flex items-center">
      <Loader2 className="animate-spin h-4 w-4 mr-2" />
      Committing...
    </div>
  ) : (
    'Commit Intent'
  )

  const isCommitButtonDisabled = Boolean(
    commitIntentConfigMutation.isPending || (isAutoExecuteEnabled && intentOperations && !!intentPreconditions?.length),
  )

  // Update button text and disabled state for send transaction button
  const sendButtonText = isSwitchingChain ? (
    <div className="flex items-center">
      <Loader2 className="animate-spin h-4 w-4 mr-2" />
      Switching Chain...
    </div>
  ) : isSendingTransaction || isWaitingForReceipt ? (
    <div className="flex items-center">
      <Loader2 className="animate-spin h-4 w-4 mr-2" />
      {isWaitingForReceipt ? 'Waiting...' : 'Sending...'}
    </div>
  ) : isChainSwitchRequired ? (
    'Switch Chain'
  ) : (
    'Send Transaction'
  )

  const isSendButtonDisabled =
    !verificationStatus?.success ||
    isSendingTransaction ||
    isWaitingForReceipt ||
    !originCallParams ||
    !!originCallParams.error ||
    isSwitchingChain ||
    (isAutoExecuteEnabled && commitIntentConfigMutation.isSuccess) // Disable if auto-execute is on and commit was successful

  // Add this after createIntentMutation's onSuccess handler
  useEffect(() => {
    if (intentOperations) {
      // Initialize operation statuses
      const initialStatuses: {
        [key: string]: { status: 'pending' | 'success' | 'failed'; txHash?: string; error?: string }
      } = {}
      intentOperations.forEach((operation, index) => {
        initialStatuses[`${operation.chainId}-${index}`] = { status: 'pending' }
      })
      setOperationStatuses(initialStatuses)
    }
  }, [intentOperations])

  // Add this after the receipt effect
  useEffect(() => {
    if (receipt && intentOperations) {
      // Update operation statuses based on receipt
      setOperationStatuses((prev) => {
        const newStatuses = { ...prev }
        intentOperations.forEach((operation, index) => {
          const key = `${operation.chainId}-${index}`
          if (receipt.status === 'success') {
            newStatuses[key] = {
              status: 'success',
              txHash: receipt.transactionHash,
            }
          } else {
            newStatuses[key] = {
              status: 'failed',
              txHash: receipt.transactionHash,
              error: 'Transaction failed',
            }
          }
        })
        return newStatuses
      })
    }
  }, [receipt, intentOperations])

  // Add this to reset operation statuses when account disconnects
  useEffect(() => {
    if (!account.isConnected) {
      setOperationStatuses({})
    }
  }, [account.isConnected])

  // Replace the monitoring effect with individual hook calls for each operation
  const operation0Status = useMetaTxnMonitor(
    operationHashes[`${intentOperations?.[0]?.chainId}-0`],
    intentOperations?.[0]?.chainId || '',
    intentOperations?.[0] ? getRelayer(parseInt(intentOperations[0].chainId)) : undefined,
  )

  const operation1Status = useMetaTxnMonitor(
    operationHashes[`${intentOperations?.[1]?.chainId}-1`],
    intentOperations?.[1]?.chainId || '',
    intentOperations?.[1] ? getRelayer(parseInt(intentOperations[1].chainId)) : undefined,
  )

  // Update operation statuses when individual operation statuses change
  useEffect(() => {
    if (!intentOperations) return

    const newStatuses: {
      [key: string]: {
        status: 'pending' | 'success' | 'failed'
        txHash?: string
        error?: string
        preconditionsMet?: boolean
        lastPreconditionCheck?: string
      }
    } = {}

    if (intentOperations[0]) {
      newStatuses[`${intentOperations[0].chainId}-0`] = operation0Status
    }
    if (intentOperations[1]) {
      newStatuses[`${intentOperations[1].chainId}-1`] = operation1Status
    }

    setOperationStatuses((prev) => ({
      ...prev,
      ...newStatuses,
    }))
  }, [intentOperations, operation0Status, operation1Status])

  // Effect to cleanup operation statuses and hashes when intent operations are reset
  useEffect(() => {
    if (!intentOperations) {
      setOperationStatuses({})
      setOperationHashes({})
    }
  }, [intentOperations])

  // Effect to cleanup operation statuses and hashes when account disconnects
  useEffect(() => {
    if (!account.isConnected) {
      setOperationStatuses({})
      setOperationHashes({})
      setIntentOperations(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
      setCommittedIntentAddress(null)
      setVerificationStatus(null)
    }
  }, [account.isConnected])

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto min-h-screen">
      <div className="text-center mb-8 animate-fadeIn">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
          Sequence Anypay Demo
        </h1>
        <p className="text-gray-300 text-sm">Connect your wallet and explore cross-chain payment intents</p>
      </div>

      {/* Account Info & Connect/Disconnect */}
      <div className="bg-gray-800/80 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm transition-all duration-300 hover:shadow-blue-900/20 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
              <span>1</span>
            </div>
            <h3 className="text-xl font-semibold text-white">Account</h3>
          </div>
          <div className="px-3 py-1 rounded-full bg-gray-700/50 text-gray-300 text-sm flex items-center">
            <span
              className={`w-2 h-2 rounded-full ${account.status === 'connected' ? 'bg-green-400' : 'bg-yellow-400'} mr-2 animate-pulse`}
            ></span>
            {account.status === 'connected' ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        {account.status === 'connected' ? (
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/30 space-y-2">
            <div className="flex items-center justify-between">
              <Text variant="small" color="secondary" className="flex items-center">
                <span className="text-blue-300 font-semibold mr-2">Address:</span>
                <span className="font-mono bg-gray-800/70 px-3 py-1 rounded-full">{account.address}</span>
              </Text>
              <Button variant="danger" size="sm" onClick={() => disconnect()} className="px-5 py-2">
                Disconnect
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Text variant="small" color="secondary" className="flex items-center">
                <span className="text-blue-300 font-semibold mr-2">Chain:</span>
                <div className="flex items-center">
                  <NetworkImage chainId={account.chainId} size="sm" className="w-4 h-4 mr-1" />
                  <span className="font-mono bg-gray-800/70 px-3 py-1 rounded-full">{account.chainId}</span>
                </div>
              </Text>
              <Text variant="small" color="secondary" className="flex items-center">
                <span className="text-blue-300 font-semibold mr-2">Status:</span>
                <span className="text-green-400 font-mono bg-green-900/20 px-3 py-1 rounded-full border border-green-700/30">
                  {account.status}
                </span>
              </Text>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/30">
            <Text variant="small" color="secondary" className="mb-3">
              Select a wallet to connect:
            </Text>
            <div className="flex flex-wrap gap-2 mb-4" data-component-name="HomeIndexRoute">
              {connectors.map((connector: Connector) => (
                <Button
                  key={connector.uid}
                  variant="primary"
                  size="sm"
                  onClick={() => connect({ connector })}
                  className="px-5 py-2 transition-all duration-300 transform hover:scale-105 hover:shadow-lg shadow-md"
                >
                  {connector.name}
                </Button>
              ))}
            </div>
            <div className="mt-3 bg-gray-800/70 p-2 rounded-lg flex items-center justify-between">
              <Text variant="small" color="secondary" className="flex items-center">
                <span className="text-blue-300 font-semibold mr-2">Status:</span>
                <span className="text-yellow-400 font-mono">
                  {account.status}
                  {connectStatus === 'pending' && <span className="ml-1">(Connecting...)</span>}
                </span>
              </Text>
              {connectError && (
                <Text variant="small" color="error" className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {connectError.message}
                </Text>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Workflow Card */}
      {account.status === 'connected' && (
        <div className="bg-gray-800/80 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm space-y-6 transition-all duration-300 hover:shadow-blue-900/20 mb-6">
          {/* 1. Select Token */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                  <span>2</span>
                </div>
                <h3 className="text-xl font-semibold text-white">Select Origin Token</h3>
              </div>
              <div className="px-3 py-1 rounded-full bg-gray-700/50 text-gray-300 text-sm flex items-center">
                <span
                  className={`w-2 h-2 rounded-full ${isLoadingBalances ? 'bg-yellow-400' : sortedTokens.length > 0 ? 'bg-green-400' : 'bg-red-400'} mr-2 animate-pulse`}
                ></span>
                {isLoadingBalances
                  ? 'Loading...'
                  : sortedTokens.length > 0
                    ? `${sortedTokens.length} Tokens`
                    : 'No Tokens'}
              </div>
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
                      setMetaTxns(null)
                      setCommittedIntentAddress(null)
                      setVerificationStatus(null)
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                <span>3</span>
              </div>
              <h3 className="text-xl font-semibold text-white">Choose Action</h3>
            </div>
            {/* Auto-Execute Toggle */}
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Text variant="medium" color="primary" className="flex items-center">
                    <Zap className="h-4 w-4 mr-2" />
                    Auto-Execute
                  </Text>
                  <Text variant="small" color="secondary" className="text-gray-400">
                    (Automatically commits and executes transactions when ready)
                  </Text>
                </div>
                <div className="flex items-center space-x-2">
                  <Text variant="small" color="secondary">
                    {isAutoExecuteEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                  <div
                    onClick={() => setIsAutoExecuteEnabled(!isAutoExecuteEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      isAutoExecuteEnabled ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isAutoExecuteEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleActionClick('pay')}
                disabled={!selectedToken || createIntentMutation.isPending}
                className="px-2.5 py-1 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
              >
                {createIntentMutation.isPending && createIntentMutation.variables === 'pay' ? (
                  'Processing...'
                ) : (
                  <>
                    <NetworkImage chainId={8453} size="sm" className="w-5 h-5" />
                    <span>
                      Pay Action{' '}
                      <Text variant="small" color="secondary">
                        (0.03 $USDC to Vitalik)
                      </Text>
                    </span>
                  </>
                )}
              </Button>
              <Button
                variant="raised"
                size="sm"
                onClick={() => handleActionClick('mock_interaction')}
                disabled={!selectedToken || createIntentMutation.isPending}
                className="px-2.5 py-1 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
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
                size="sm"
                onClick={() => handleActionClick('custom_call')}
                disabled={!selectedToken || createIntentMutation.isPending}
                className="px-2.5 py-1 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
              >
                {createIntentMutation.isPending && createIntentMutation.variables === 'custom_call' ? (
                  'Processing...'
                ) : (
                  <div className="flex items-center gap-2">
                    <PenSquare className="h-5 w-5" />
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
                      size="sm"
                      onClick={() => setShowCustomCallForm(false)}
                      className="px-4 py-2"
                    >
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" className="px-4 py-2">
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
                <AlertTriangle className="h-4 w-4 mr-1" />
                Please select a token first.
              </Text>
            )}
          </div>

          {/* 3. Intent Quote Display */}
          <div>
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                <span>4</span>
              </div>
              <h3 className="text-xl font-semibold text-white">Intent Quote</h3>
            </div>
            {createIntentMutation.isPending && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 animate-pulse">
                <div className="flex items-center text-center">
                  <Loader2 className="animate-spin h-4 w-4 mr-2 text-yellow-500" />
                  <Text variant="small" color="warning">
                    Generating intent quote...
                  </Text>
                </div>
              </div>
            )}
            {createIntentMutation.isError && (
              <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                <Text variant="small" color="negative" className="break-words flex items-center text-center">
                  <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>Error: {createIntentMutation.error.message}</span>
                </Text>
              </div>
            )}
            {intentOperations && (
              <div className="text-xs text-gray-300 bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
                <Text
                  variant="medium"
                  color="primary"
                  className="mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Intent Operations
                  <Text variant="small" color="secondary" className="ml-1">
                    (List of operations that are pre-authorized to be executed):
                  </Text>
                </Text>

                {/* Intent Operations Section */}
                {intentOperations && intentOperations.length > 0 ? (
                  <div className="space-y-2">
                    {intentOperations.map((operation, index) => (
                      <div
                        key={`operation-${index}`}
                        className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50"
                      >
                        <div className="pb-2">
                          <Text variant="small" color="primary" className="font-semibold">
                            Operation #{index + 1}
                          </Text>
                        </div>
                        {operation.calls &&
                          operation.calls.length > 0 &&
                          operation.calls.map((call, callIndex) => (
                            <div key={`call-${index}-${callIndex}`} className="space-y-2">
                              <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                                <Text variant="small" color="secondary">
                                  <strong className="text-blue-300">To: </strong>{' '}
                                  <span className="text-yellow-300 break-all font-mono">{call.to}</span>
                                </Text>
                              </div>
                              <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                                <Text variant="small" color="secondary">
                                  <strong className="text-blue-300">Value: </strong>
                                  <span className="font-mono">{call.value || '0'}</span>
                                </Text>
                              </div>
                              <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                                <Text variant="small" color="secondary">
                                  <div className="break-all">
                                    <strong className="text-blue-300">Data: </strong>
                                    <div className="max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                                      <span className="font-mono text-green-300">{call.data || '0x'}</span>
                                    </div>
                                  </div>
                                </Text>
                              </div>
                              <div className="bg-gray-800/70 p-2 rounded-md mb-1 flex items-center">
                                <Text variant="small" color="secondary">
                                  <strong className="text-blue-300">Chain ID: </strong>
                                  <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded-full">
                                    {operation.chainId}
                                  </span>
                                </Text>
                                <NetworkImage
                                  chainId={parseInt(operation.chainId)}
                                  size="sm"
                                  className="w-4 h-4 ml-1"
                                />
                                <Text variant="small" color="secondary" className="ml-1">
                                  {getChainInfo(parseInt(operation.chainId))?.name || 'Unknown Chain'}
                                </Text>
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-800/70 p-3 rounded-md border border-gray-700/50">
                    <Text variant="small" color="secondary">
                      No operations available.
                    </Text>
                  </div>
                )}

                {/* Meta-transactions Section */}
                {metaTxns && metaTxns.length > 0 && (
                  <div className="mt-4">
                    <Text
                      variant="medium"
                      color="primary"
                      className="mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                    >
                      <Layers className="h-4 w-4 mr-1" />
                      Meta-transactions
                      <Text variant="small" color="secondary" className="ml-1">
                        (Transactions that will be relayed):
                      </Text>
                    </Text>
                    <div className="space-y-2">
                      {metaTxns.map((tx, index) => (
                        <div
                          key={`metatx-${index}`}
                          className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50"
                        >
                          <div className="space-y-2">
                            <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                              <Text variant="small" color="secondary">
                                <strong className="text-blue-300">Contract: </strong>
                                <span className="text-yellow-300 break-all font-mono">{tx.contract}</span>
                              </Text>
                            </div>
                            <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                              <Text variant="small" color="secondary">
                                <strong className="text-blue-300">Chain ID: </strong>
                                <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded-full">{tx.chainId}</span>
                                <NetworkImage
                                  chainId={parseInt(tx.chainId)}
                                  size="sm"
                                  className="w-4 h-4 ml-1 inline-block"
                                />
                                <span className="ml-1">
                                  {getChainInfo(parseInt(tx.chainId))?.name || 'Unknown Chain'}
                                </span>
                              </Text>
                            </div>
                            <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                              <Text variant="small" color="secondary">
                                <div className="break-all">
                                  <strong className="text-blue-300">Input Data: </strong>
                                  <div className="max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                                    <span className="font-mono text-green-300">{tx.input || '0x'}</span>
                                  </div>
                                </div>
                              </Text>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preconditions Section */}
                {intentPreconditions && intentPreconditions.length > 0 && (
                  <>
                    <Text
                      variant="medium"
                      color="primary"
                      className="mt-4 mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                    >
                      <Box className="h-4 w-4 mr-1" />
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
                      <Info className="h-4 w-4 mr-1 text-gray-500" />
                      No specific preconditions returned for this intent.
                    </Text>
                  </div>
                )}
              </div>
            )}

            {!createIntentMutation.isPending && !createIntentMutation.isError && !intentOperations && (
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-4 flex items-center justify-center">
                <Text variant="small" color="secondary" className="flex flex-col items-center text-center">
                  <ShieldCheck className="h-10 w-10 text-gray-600 mb-2" />
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
                  <span>5</span>
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
                      <Zap className="h-4 w-4 mr-1" />
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
                          walletAddress: calculateIntentAddress(intentOperations, account.address).toString(),
                          mainSigner: account.address,
                          operations: intentOperations,
                          preconditions: intentPreconditions,
                        })
                      }}
                      disabled={isCommitButtonDisabled}
                      className="px-2.5 py-1 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {commitButtonText}
                    </Button>
                  </div>

                  {/* Verification Banner */}
                  {verificationStatus && (
                    <div
                      className={`bg-gray-900/50 p-3 rounded-lg border ${verificationStatus.success ? 'border-green-700/30' : 'border-red-700/30'}`}
                    >
                      <div className="flex items-center">
                        <div className="flex flex-col w-full">
                          <Text
                            variant="small"
                            color={verificationStatus.success ? 'info' : 'negative'}
                            className="font-semibold"
                          >
                            {verificationStatus.success
                              ? 'Address Verification Successful'
                              : 'Address Verification Failed'}
                          </Text>
                          <div className="mt-2 text-xs text-gray-400 flex flex-col space-y-1 w-full">
                            <div>
                              Calculated:{' '}
                              <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
                                {verificationStatus.calculatedAddress || 'N/A'}
                              </span>
                            </div>
                            <div>
                              Expected (from precondition):{' '}
                              <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
                                {verificationStatus.receivedAddress || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commit Status Messages */}
                  {commitIntentConfigMutation.isError && (
                    <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 mt-2">
                      <Text variant="small" color="negative">
                        Commit Error: {commitIntentConfigMutation.error.message}
                      </Text>
                    </div>
                  )}
                  {commitIntentConfigMutation.isSuccess && (
                    <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 mt-2">
                      <Text variant="small" color="white">
                        Intent configuration committed successfully! Fetching details...
                      </Text>
                    </div>
                  )}

                  {/* Display Fetched Committed Config */}
                  {committedIntentAddress && commitIntentConfigMutation.isSuccess && (
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <Text variant="medium" color="primary" className="border-b border-gray-700/50">
                          Committed Configuration Details on Database
                        </Text>
                      </div>
                      {isLoadingCommittedConfig && (
                        <div className="flex items-center text-center">
                          <Loader2 className="animate-spin h-4 w-4 mr-2 text-yellow-500" />
                          <Text variant="small" color="secondary">
                            Loading committed config...
                          </Text>
                        </div>
                      )}
                      {committedConfigError && (
                        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                          <Text variant="small" color="negative" className="break-words flex items-center text-center">
                            <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>Error fetching config: {committedConfigError.message}</span>
                          </Text>
                        </div>
                      )}
                      {committedIntentConfig && !isLoadingCommittedConfig && !committedConfigError && (
                        <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap bg-gray-800/70 p-3 text-gray-300 rounded-md max-h-60 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                          {JSON.stringify(committedIntentConfig, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. Origin Call */}
          {intentOperations && intentPreconditions && (
            <div>
              <div className="flex items-center mb-4">
                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                  <span>6</span>
                </div>
                <h3 className="text-xl font-semibold text-white">Origin Call</h3>
              </div>
              <div className="text-xs text-gray-300 bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
                <Text variant="medium" color="primary" className="pb-1 border-b border-gray-700/50 flex items-center">
                  <Zap className="h-4 w-4 mr-1" />
                  Transaction Details
                  <Text variant="small" color="secondary" className="ml-1">
                    (Send this transaction to execute the intent):
                  </Text>
                </Text>
                <div className="space-y-2">
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">From: </strong>
                      <span className="text-yellow-300 break-all font-mono">{account.address ?? '...'}</span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">To: </strong>
                      <span className="text-yellow-300 break-all font-mono">
                        {originCallParams?.to ?? (originCallParams?.error ? 'Error' : 'Calculating...')}
                      </span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Value: </strong>
                      <span className="font-mono">
                        {originCallParams?.value?.toString() ?? (originCallParams?.error ? 'Error' : 'Calculating...')}
                      </span>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md">
                    <Text variant="small" color="secondary">
                      <div className="break-all">
                        <strong className="text-blue-300">Data: </strong>
                        <div className="max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                          <span className="font-mono text-green-300">
                            {originCallParams?.data ?? (originCallParams?.error ? 'Error' : 'Calculating...')}
                          </span>
                        </div>
                      </div>
                    </Text>
                  </div>
                  <div className="bg-gray-800/70 p-2 rounded-md flex items-center">
                    <Text variant="small" color="secondary">
                      <strong className="text-blue-300">Chain ID: </strong>
                      <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded-full">
                        {originCallParams?.chainId?.toString() ??
                          (originCallParams?.error ? 'Error' : 'Calculating...')}
                      </span>
                    </Text>
                    {originCallParams?.chainId && (
                      <>
                        <NetworkImage chainId={originCallParams.chainId} size="sm" className="w-4 h-4 ml-1" />
                        <Text variant="small" color="secondary" className="ml-1">
                          {getChainInfo(originCallParams.chainId)?.name || 'Unknown Chain'}
                        </Text>
                      </>
                    )}
                  </div>
                  {originCallParams?.error && (
                    <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-2 mt-2">
                      <Text variant="small" color="negative">
                        Error calculating params: {originCallParams.error}
                      </Text>
                    </div>
                  )}
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="primary"
                      onClick={handleSendOriginCall}
                      disabled={isSendButtonDisabled}
                      className="px-2.5 py-1 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {sendButtonText}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview calculated address */}
          {account.address && intentOperations && (
            <div className="bg-gray-900/50 p-3 rounded-lg border border-blue-700/30">
              <Text variant="small" color="secondary">
                <strong className="text-blue-300">Calculated Address: </strong>
                <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
                  {originCallParams?.to?.toString() || 'N/A'}
                </span>
              </Text>
            </div>
          )}
        </div>
      )}

      {/* Separate Relayer Status Card */}
      {account.status === 'connected' && intentOperations && intentPreconditions && (
        <div className="bg-gray-800/80 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm transition-all duration-300 hover:shadow-blue-900/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                <span>7</span>
              </div>
              <h3 className="text-xl font-semibold text-white">Relayer Status</h3>
            </div>
          </div>

          <div className="space-y-6">
            {/* Origin Call Status */}
            <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto shadow-inner">
              <Text
                variant="medium"
                color="primary"
                className="mb-4 pb-2 border-b border-gray-700/50 flex items-center"
              >
                <Layers className="h-4 w-4 mr-2" />
                Origin Call Status
              </Text>
              <div className="space-y-3">
                <div className="bg-gray-800/70 p-3 rounded-md">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Transaction Hash: </strong>
                    <span className="text-yellow-300 break-all font-mono">
                      {metaTxnStatus?.txnHash || 'Not sent yet'}
                    </span>
                  </Text>
                </div>
                <div className="bg-gray-800/70 p-3 rounded-md">
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
                              : 'text-gray-400'
                      }`}
                    >
                      {metaTxnStatus?.status || 'Idle'}
                    </span>
                    {isWaitingForReceipt && <span className="text-yellow-400 ml-1">(Waiting for confirmation...)</span>}
                  </Text>
                </div>
                {metaTxnStatus?.revertReason && (
                  <div className="bg-gray-800/70 p-3 rounded-md">
                    <Text variant="small" color="secondary" className="break-all">
                      <strong className="text-blue-300">Revert Reason: </strong>
                      <span className="font-mono text-red-300">{metaTxnStatus.revertReason}</span>
                    </Text>
                  </div>
                )}
                <div className="bg-gray-800/70 p-3 rounded-md">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Gas Used: </strong>
                    <span className="font-mono">{metaTxnStatus?.gasUsed || '0'}</span>
                  </Text>
                </div>
                <div className="bg-gray-800/70 p-3 rounded-md">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Effective Gas Price: </strong>
                    <span className="font-mono">{metaTxnStatus?.effectiveGasPrice || '0'}</span>
                  </Text>
                </div>
              </div>
            </div>

            {/* Intent Operations Status */}
            <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto shadow-inner">
              <Text
                variant="medium"
                color="primary"
                className="mb-4 pb-2 border-b border-gray-700/50 flex items-center"
              >
                <Box className="h-4 w-4 mr-2" />
                Intent Operations Status
              </Text>
              <div className="space-y-4">
                {intentOperations.map((operation, index) => (
                  <div key={`operation-${index}`} className="bg-gray-800/70 p-3 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <Text variant="small" color="primary" className="font-semibold flex items-center">
                        <NetworkImage chainId={parseInt(operation.chainId)} size="sm" className="w-4 h-4 mr-2" />
                        Operation #{index + 1} - Chain {operation.chainId}
                        <span className="text-gray-400 text-xs ml-2">
                          ({getChainInfo(parseInt(operation.chainId))?.name || 'Unknown Chain'})
                        </span>
                      </Text>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          operationStatuses[`${operation.chainId}-${index}`]?.status === 'success'
                            ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                            : operationStatuses[`${operation.chainId}-${index}`]?.status === 'failed'
                              ? 'bg-red-900/30 text-red-400 border border-red-700/30'
                              : 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
                        }`}
                      >
                        {operationStatuses[`${operation.chainId}-${index}`]?.status === 'success'
                          ? 'Success'
                          : operationStatuses[`${operation.chainId}-${index}`]?.status === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                      </div>
                    </div>
                    {operationStatuses[`${operation.chainId}-${index}`]?.txHash && (
                      <Text variant="small" color="secondary" className="mt-2">
                        <strong className="text-blue-300">Tx Hash: </strong>
                        <span className="font-mono text-yellow-300 break-all">
                          {operationStatuses[`${operation.chainId}-${index}`].txHash}
                        </span>
                      </Text>
                    )}
                    {operationStatuses[`${operation.chainId}-${index}`]?.error && (
                      <Text variant="small" color="negative" className="mt-2">
                        <strong className="text-red-300">Error: </strong>
                        <span className="font-mono break-all">
                          {operationStatuses[`${operation.chainId}-${index}`].error}
                        </span>
                      </Text>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preconditions Status */}
            <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto shadow-inner">
              <Text
                variant="medium"
                color="primary"
                className="mb-4 pb-2 border-b border-gray-700/50 flex items-center"
              >
                <Clipboard className="h-4 w-4 mr-2" />
                Preconditions Status
              </Text>
              <div className="space-y-3">
                {intentPreconditions.map((precondition, index) => (
                  <div key={index} className="bg-gray-800/70 p-3 rounded-md">
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
