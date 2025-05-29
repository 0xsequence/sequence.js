import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect, useSendTransaction, useSwitchChain, useEstimateGas } from 'wagmi'
import { Connector } from 'wagmi'
import { NativeTokenBalance, TokenBalance } from '@0xsequence/indexer'
import {
  GetIntentCallsPayloadsReturn,
  IntentCallsPayload,
  IntentPrecondition,
  GetIntentConfigReturn,
  AnypayLifiInfo,
} from '@0xsequence/api'
import { formatUnits, Hex, isAddressEqual, zeroAddress } from 'viem'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAPIClient } from '@/hooks/useAPIClient'
import { Button, Text, NetworkImage } from '@0xsequence/design-system'
import { AbiFunction, Address, Bytes } from 'ox'
import * as chains from 'viem/chains'
import { AnyPay } from '@0xsequence/wallet-core'
import { Context as ContextLike } from '@0xsequence/wallet-primitives'
import { useWaitForTransactionReceipt } from 'wagmi'
import { useMetaTxnsMonitor, MetaTxn } from '@/hooks/useMetaTxnsMonitor'
import { useRelayers } from '@/hooks/useRelayers'
import { useTokenBalances } from '@/hooks/useTokenBalances'
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
import { SectionHeader } from '@/components/SectionHeader'

// Helper to get chain info
const getChainInfo = (chainId: number) => {
  return Object.values(chains).find((chain) => chain.id === chainId) || null
}

const getExplorerUrl = (chainId: number, address: string): string | null => {
  const chainInfo = getChainInfo(chainId)
  if (chainInfo && chainInfo.blockExplorers?.default?.url) {
    return `${chainInfo.blockExplorers.default.url}/address/${address}`
  }
  return null
}

export const getExplorerTransactionUrl = (chainId: number, transactionHash: string): string | null => {
  const chainInfo = getChainInfo(chainId)
  if (chainInfo && chainInfo.blockExplorers?.default?.url) {
    return `${chainInfo.blockExplorers.default.url}/tx/${transactionHash}`
  }
  return null
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
const MOCK_TOKEN_AMOUNT = '3000000'

// Chain ID for destination chain (base)
const BASE_USDC_DESTINATION_CHAIN_ID = chains.base.id
// USDC Address for interaction on destination chain (base)
const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
// Give Directly - recipient Address for interaction on destination chain (base)
const RECIPIENT_ADDRESS = '0x750EF1D7a0b4Ab1c97B7A623D7917CcEb5ea779C'
// Amount of USDC to transfer on destination chain (base)
const AMOUNT = 300000n // 0.3 USDC (6 decimals)

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
  const [isEstimatingGas, setIsEstimatingGas] = useState(false)
  const [customCallData, setCustomCallData] = useState({
    to: '',
    data: '',
    value: '0',
    chainId: BASE_USDC_DESTINATION_CHAIN_ID.toString(),
    tokenAmount: '0',
    tokenAddress: BASE_USDC_ADDRESS,
  })

  const apiClient = useAPIClient()

  // State declarations
  const [metaTxns, setMetaTxns] = useState<GetIntentCallsPayloadsReturn['metaTxns'] | null>(null)
  const [intentCallsPayloads, setIntentCallsPayloads] = useState<GetIntentCallsPayloadsReturn['calls'] | null>(null)
  const [intentPreconditions, setIntentPreconditions] = useState<GetIntentCallsPayloadsReturn['preconditions'] | null>(
    null,
  )
  const [lifiInfos, setLifiInfos] = useState<GetIntentCallsPayloadsReturn['lifiInfos'] | null>(null)
  const [txnHash, setTxnHash] = useState<Hex | undefined>()
  const [committedIntentAddress, setCommittedIntentAddress] = useState<string | null>(null)
  // const [preconditionStatuses, setPreconditionStatuses] = useState<boolean[]>([])
  const [verificationStatus, setVerificationStatus] = useState<{
    success: boolean
    receivedAddress?: string
    calculatedAddress?: string
  } | null>(null)
  const [originCallStatus, setOriginCallStatus] = useState<{
    txnHash?: string
    status?: string
    revertReason?: string | null
    gasUsed?: number
    effectiveGasPrice?: string
  } | null>(null)
  const [originCallParams, setOriginCallParams] = useState<OriginCallParams | null>(null)
  const [isChainSwitchRequired, setIsChainSwitchRequired] = useState(false)
  const [isAutoExecuteEnabled, setIsAutoExecuteEnabled] = useState(true)
  const [isTransactionInProgress, setIsTransactionInProgress] = useState(false)
  const { sortedTokens, isLoadingBalances, balanceError } = useTokenBalances(account.address as Address.Address)

  // Track timestamps of when each meta-transaction was last sent
  const [sentMetaTxns, setSentMetaTxns] = useState<{ [key: string]: number }>({})

  const [isManualMetaTxnEnabled, setIsManualMetaTxnEnabled] = useState(false)
  const [selectedMetaTxnId, setSelectedMetaTxnId] = useState<string | null>(null)
  const [hasAutoExecuted, setHasAutoExecuted] = useState(false)

  const RETRY_WINDOW_MS = 10_000

  const { getRelayer } = useRelayers()

  // Add monitoring for each meta transaction
  const metaTxnMonitorStatuses = useMetaTxnsMonitor(metaTxns as unknown as MetaTxn[] | undefined, getRelayer)

  // Add gas estimation hook with proper types
  const {
    data: estimatedGas,
    isError: isEstimateError,
    error: estimateError,
  } = useEstimateGas(
    originCallParams?.to && originCallParams?.chainId && !originCallParams.error
      ? {
          to: originCallParams.to || undefined,
          data: originCallParams.data || undefined,
          value: originCallParams.value || undefined,
          chainId: originCallParams.chainId || undefined,
        }
      : undefined,
  )

  const calculateIntentAddress = useCallback(
    (mainSigner: string, calls: IntentCallsPayload[], lifiInfosArg: AnypayLifiInfo[] | null | undefined) => {
      try {
        console.log('Calculating intent address...')
        console.log('Main signer:', mainSigner)
        console.log('Calls:', JSON.stringify(calls, null, 2))
        console.log('LifiInfos (API type from arg):', JSON.stringify(lifiInfosArg, null, 2))

        const context: ContextLike.Context = {
          factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447' as `0x${string}`,
          stage1: '0x53bA242E7C2501839DF2972c75075dc693176Cd0' as `0x${string}`,
          stage2: '0xa29874c88b8Fd557e42219B04b0CeC693e1712f5' as `0x${string}`,
          creationCode:
            '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as `0x${string}`,
        }

        const coreCalls = calls.map((call) => ({
          type: 'call' as const,
          chainId: BigInt(call.chainId),
          space: call.space ? BigInt(call.space) : 0n,
          nonce: call.nonce ? BigInt(call.nonce) : 0n,
          calls: call.calls.map((call) => ({
            to: Address.from(call.to),
            value: BigInt(call.value || '0'),
            data: Bytes.toHex(Bytes.from((call.data as Hex) || '0x')),
            gasLimit: BigInt(call.gasLimit || '0'),
            delegateCall: !!call.delegateCall,
            onlyFallback: !!call.onlyFallback,
            behaviorOnError: (Number(call.behaviorOnError) === 0
              ? 'ignore'
              : Number(call.behaviorOnError) === 1
                ? 'revert'
                : 'abort') as 'ignore' | 'revert' | 'abort',
          })),
        }))

        const coreLifiInfos = lifiInfosArg?.map((info: AnypayLifiInfo) => ({
          originToken: Address.from(info.originToken),
          amount: BigInt(info.amount),
          originChainId: BigInt(info.originChainId),
          destinationChainId: BigInt(info.destinationChainId),
        }))

        return AnyPay.calculateIntentConfigurationAddress(
          Address.from(mainSigner),
          coreCalls,
          context,
          // AnyPay.ANYPAY_LIFI_ATTESATION_SIGNER_ADDRESS,
          Address.from('0x0000000000000000000000000000000000000001'),
          coreLifiInfos,
        )
      } catch (error) {
        console.error('Error calculating intent address:', error)
        throw error
      }
    },
    [],
  )

  const updateOriginCallStatus = (
    hash: Hex | undefined,
    status: 'success' | 'reverted' | 'pending' | 'sending',
    gasUsed?: bigint,
    effectiveGasPrice?: bigint,
    revertReason?: string | null,
  ) => {
    setOriginCallStatus({
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

  // const checkPreconditionStatuses = useCallback(async () => {
  //   if (!intentPreconditions) return

  //   const statuses = await Promise.all(
  //     intentPreconditions.map(async (precondition) => {
  //       try {
  //         const chainIdString = precondition.chainId
  //         if (!chainIdString) {
  //           console.warn('Precondition missing chainId:', precondition)
  //           return false
  //         }
  //         const chainId = parseInt(chainIdString)
  //         if (isNaN(chainId) || chainId <= 0) {
  //           console.warn('Precondition has invalid chainId:', chainIdString, precondition)
  //           return false
  //         }

  //         const chainRelayer = getRelayer(chainId)
  //         if (!chainRelayer) {
  //           console.error(`No relayer found for chainId: ${chainId}`)
  //           return false
  //         }

  //         return await chainRelayer.checkPrecondition(precondition)
  //       } catch (error) {
  //         console.error('Error checking precondition:', error, 'Precondition:', precondition)
  //         return false
  //       }
  //     }),
  //   )

  //   setPreconditionStatuses(statuses)
  // }, [intentPreconditions, getRelayer])

  // useEffect(() => {
  //   // TODO: Remove this once we have a way to check precondition statuses
  //   if (false) {
  //     checkPreconditionStatuses()
  //   }
  // }, [intentPreconditions, checkPreconditionStatuses])

  const commitIntentConfigMutation = useMutation({
    mutationFn: async (args: {
      walletAddress: string
      mainSigner: string
      calls: IntentCallsPayload[]
      preconditions: IntentPrecondition[]
      lifiInfos: AnypayLifiInfo[]
    }) => {
      if (!apiClient) throw new Error('API client not available')
      if (!account.address) throw new Error('Account address not available')
      if (!args.lifiInfos) throw new Error('LifiInfos not available')

      try {
        console.log('Calculating intent address...')
        console.log('Main signer:', args.mainSigner)
        console.log('Calls:', args.calls)
        console.log('LifiInfos:', args.lifiInfos)

        const calculatedAddress = calculateIntentAddress(args.mainSigner, args.calls, args.lifiInfos)
        const receivedAddress = findPreconditionAddress(args.preconditions)

        console.log('Calculated address:', calculatedAddress.toString())
        console.log('Received address:', receivedAddress)

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
          calls: args.calls,
          preconditions: args.preconditions,
          lifiInfos: args.lifiInfos,
        })
        console.log('API Commit Response:', response)
        return { calculatedAddress: calculatedAddress.toString(), response }
      } catch (error) {
        console.error('Error during commit intent mutation:', error)
        if (!verificationStatus?.success && !verificationStatus?.receivedAddress) {
          try {
            const calculatedAddress = calculateIntentAddress(args.mainSigner, args.calls, args.lifiInfos)
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
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  })

  const createIntentMutation = useMutation<GetIntentCallsPayloadsReturn, Error, IntentAction>({
    mutationFn: async (action: IntentAction) => {
      if (!apiClient || !selectedToken || !account.address) {
        throw new Error('Missing API client, selected token, or account address')
      }
      // Reset commit state when generating a new intent
      setCommittedIntentAddress(null)
      setVerificationStatus(null)

      let destinationCall
      if (action === 'pay') {
        // ERC20 ABI functions
        const erc20Transfer = AbiFunction.from('function transfer(address,uint256) returns (bool)')
        const encodedData = AbiFunction.encodeData(erc20Transfer, [RECIPIENT_ADDRESS, AMOUNT]) as Hex

        // Ensure calldata is prefixed with 0x
        const transactionData = encodedData.startsWith('0x') ? encodedData : `0x${encodedData}`

        destinationCall = {
          chainId: BASE_USDC_DESTINATION_CHAIN_ID,
          to: BASE_USDC_ADDRESS,
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
      } else if (action === 'mock_interaction') {
        // Ensure mock data is prefixed with 0x
        const transactionData = MOCK_TRANSFER_DATA.startsWith('0x') ? MOCK_TRANSFER_DATA : `0x${MOCK_TRANSFER_DATA}`
        const destinationChainId = selectedToken.chainId || 8453

        destinationCall = {
          chainId: destinationChainId,
          to: BASE_USDC_ADDRESS,
          transactionData,
          transactionValue: '0',
        }
      } else {
        throw new Error('Invalid action')
      }

      const args = {
        userAddress: account.address,
        originChainId: selectedToken.chainId || 8453,
        originTokenAddress: selectedToken.contractAddress,
        originTokenAmount: selectedToken.balance.toString(),
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
              : BASE_USDC_ADDRESS,
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

      const data = await apiClient.getIntentCallsPayloads(args)

      setMetaTxns(data.metaTxns)
      setIntentCallsPayloads(data.calls)
      setIntentPreconditions(data.preconditions)
      setLifiInfos(data.lifiInfos) // Ensure lifiInfos is set here
      setCommittedIntentAddress(null)
      setVerificationStatus(null)
      return data
    },
    onSuccess: (data) => {
      console.log('Intent Config Success:', data)
      if (
        data &&
        data.calls &&
        data.calls.length > 0 &&
        data.preconditions &&
        data.preconditions.length > 0 &&
        data.metaTxns &&
        data.metaTxns.length > 0
      ) {
        setIntentCallsPayloads(data.calls)
        setIntentPreconditions(data.preconditions)
        setMetaTxns(data.metaTxns)
        setLifiInfos(data.lifiInfos)
      } else {
        console.warn('API returned success but no operations found.')
        setIntentCallsPayloads(null)
        setIntentPreconditions(null)
        setMetaTxns(null)
        setLifiInfos(null)
      }
    },
    onError: (error) => {
      console.error('Intent Config Error:', error)
      setIntentCallsPayloads(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
      setLifiInfos(null)
    },
  })

  useEffect(() => {
    if (!account.isConnected) {
      setSelectedToken(null)
      setIntentCallsPayloads(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
      setCommittedIntentAddress(null)
      setVerificationStatus(null)
      setHasAutoExecuted(false)
    }
  }, [account.isConnected])

  const handleActionClick = (action: IntentAction) => {
    setIntentCallsPayloads(null)
    setIntentPreconditions(null)
    setMetaTxns(null)
    setShowCustomCallForm(false)
    setCommittedIntentAddress(null)
    setVerificationStatus(null)
    setHasAutoExecuted(false)
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
      updateOriginCallStatus(undefined, 'reverted', undefined, undefined, 'Origin call parameters not ready')
      return
    }

    // Check if we need to switch chains
    if (account.chainId !== originCallParams.chainId) {
      setIsChainSwitchRequired(true)
      updateOriginCallStatus(
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
        updateOriginCallStatus(
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
      updateOriginCallStatus(undefined, 'sending')

      if (!estimatedGas && !isEstimateError) {
        setIsEstimatingGas(true)
        return // Wait for gas estimation
      }

      if (isEstimateError) {
        console.error('Gas estimation failed:', estimateError)
        updateOriginCallStatus(
          undefined,
          'reverted',
          undefined,
          undefined,
          `Gas estimation failed: ${estimateError?.message}`,
        )
        setIsTransactionInProgress(false)
        return
      }

      // Add 20% buffer to estimated gas
      const gasLimit = estimatedGas ? BigInt(Math.floor(Number(estimatedGas) * 1.2)) : undefined

      sendTransaction(
        {
          to: originCallParams.to,
          data: originCallParams.data,
          value: originCallParams.value,
          chainId: originCallParams.chainId,
          gas: gasLimit,
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
            updateOriginCallStatus(undefined, 'reverted', undefined, undefined, error.message)
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
      updateOriginCallStatus(
        undefined,
        'reverted',
        undefined,
        undefined,
        `Chain switch failed: ${switchChainError.message || 'Unknown error'}`,
      )
      setIsChainSwitchRequired(false)
    }
  }, [switchChainError])

  // Reset gas estimation state when parameters change
  useEffect(() => {
    setIsEstimatingGas(false)
  }, [originCallParams])

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

  // Modify the effect that watches for transaction status
  useEffect(() => {
    if (!txnHash) {
      // Only reset these when txnHash is cleared
      if (originCallStatus?.txnHash) {
        setOriginCallStatus(null)
      }
      if (Object.keys(sentMetaTxns).length > 0) {
        setSentMetaTxns({})
      }
      return
    }

    // Don't update status if it's already set for this hash
    if (originCallStatus?.txnHash === txnHash && !isWaitingForReceipt) {
      return
    }

    if (isWaitingForReceipt) {
      setOriginCallStatus({
        txnHash,
        status: 'Pending',
      })
      if (
        metaTxns &&
        metaTxns.length > 0 &&
        isAutoExecuteEnabled &&
        !metaTxns.some((tx) => sentMetaTxns[`${tx.chainId}-${tx.id}`])
      ) {
        console.log('Origin transaction successful, auto-sending all meta transactions...')
        // Send all meta transactions at once (pass null to send all)
        sendMetaTxn(null)
      }

      return
    }

    if (isSuccess && receipt) {
      setOriginCallStatus({
        txnHash: receipt.transactionHash,
        status: receipt.status === 'success' ? 'Success' : 'Failed',
        gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) : undefined,
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
      })
    } else if (isError) {
      setOriginCallStatus({
        txnHash,
        status: 'Failed',
        revertReason: receiptError?.message || 'Failed to get receipt',
      })
    }
  }, [
    txnHash,
    isWaitingForReceipt,
    isSuccess,
    isError,
    receipt,
    receiptError,
    metaTxns,
    sentMetaTxns,
    isAutoExecuteEnabled,
  ])

  // Modify the auto-execute effect
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
      !isChainSwitchRequired &&
      !originCallStatus &&
      !hasAutoExecuted

    if (shouldAutoSend) {
      console.log('Auto-executing transaction: All conditions met.')
      setHasAutoExecuted(true)

      // Set initial status
      setOriginCallStatus({
        status: 'Sending...',
      })

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
            setOriginCallStatus({
              status: 'Failed',
              revertReason: error.message,
            })
            setHasAutoExecuted(false)
          },
        },
      )
    }
  }, [
    isAutoExecuteEnabled,
    commitIntentConfigMutation.isSuccess,
    originCallParams,
    account.chainId,
    isSendingTransaction,
    isWaitingForReceipt,
    txnHash,
    isChainSwitchRequired,
    originCallStatus,
    hasAutoExecuted,
  ])

  useEffect(() => {
    if (!intentCallsPayloads?.[0]?.chainId || !selectedToken || !intentPreconditions || !account.address) {
      setOriginCallParams(null)
      return
    }

    try {
      const intentAddress = calculateIntentAddress(account.address, intentCallsPayloads, lifiInfos)
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
  }, [intentCallsPayloads, selectedToken, intentPreconditions, account.address, calculateIntentAddress, lifiInfos])

  // Effect to auto-commit when intent calls payloads are ready
  useEffect(() => {
    if (
      isAutoExecuteEnabled &&
      intentCallsPayloads &&
      intentPreconditions &&
      lifiInfos &&
      account.address &&
      !commitIntentConfigMutation.isPending &&
      !commitIntentConfigMutation.isSuccess
    ) {
      console.log('Auto-committing intent configuration...')
      commitIntentConfigMutation.mutate({
        walletAddress: calculateIntentAddress(account.address, intentCallsPayloads, lifiInfos).toString(),
        mainSigner: account.address,
        calls: intentCallsPayloads,
        preconditions: intentPreconditions,
        lifiInfos: lifiInfos,
      })
    }
  }, [
    isAutoExecuteEnabled,
    intentCallsPayloads,
    intentPreconditions,
    lifiInfos, // Add lifiInfos dependency
    account.address,
    commitIntentConfigMutation.isPending,
    commitIntentConfigMutation.isSuccess,
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
    commitIntentConfigMutation.isPending || commitIntentConfigMutation.isSuccess, // Disable if commit is pending OR has already succeeded
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
  ) : isEstimatingGas ? (
    <div className="flex items-center">
      <Loader2 className="animate-spin h-4 w-4 mr-2" />
      Estimating Gas...
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

  // Effect to cleanup when account disconnects
  useEffect(() => {
    if (!account.isConnected) {
      setIntentCallsPayloads(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
      setCommittedIntentAddress(null)
      setVerificationStatus(null)
      setHasAutoExecuted(false)
    }
  }, [account.isConnected])

  // Update the sendMetaTxn mutation
  const sendMetaTxnMutation = useMutation({
    mutationFn: async ({ selectedId }: { selectedId: string | null }) => {
      if (!intentCallsPayloads || !intentPreconditions || !metaTxns || !account.address || !lifiInfos) {
        throw new Error('Missing required data for meta-transaction')
      }

      try {
        const intentAddress = calculateIntentAddress(account.address, intentCallsPayloads, lifiInfos)

        // If no specific ID is selected, send all meta transactions
        const txnsToSend = selectedId ? [metaTxns.find((tx) => tx.id === selectedId)] : metaTxns

        if (!txnsToSend || (selectedId && !txnsToSend[0])) {
          throw new Error('Meta transaction not found')
        }

        const results = []

        for (const metaTxn of txnsToSend) {
          if (!metaTxn) continue

          const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
          const lastSentTime = sentMetaTxns[operationKey]
          const now = Date.now()

          if (lastSentTime && now - lastSentTime < RETRY_WINDOW_MS) {
            const timeLeft = Math.ceil((RETRY_WINDOW_MS - (now - lastSentTime)) / 1000)
            console.log(`Meta transaction for ${operationKey} was sent recently. Wait ${timeLeft}s before retry`)
            continue
          }

          try {
            const chainId = parseInt(metaTxn.chainId)
            if (isNaN(chainId) || chainId <= 0) {
              throw new Error(`Invalid chainId for meta transaction: ${chainId}`)
            }
            const chainRelayer = getRelayer(chainId)
            if (!chainRelayer) {
              throw new Error(`No relayer found for chainId: ${chainId}`)
            }

            const relevantPreconditions = intentPreconditions.filter(
              (p) => p.chainId && parseInt(p.chainId) === chainId,
            )

            console.log(
              `Relaying meta transaction ${operationKey} to intent ${intentAddress} via relayer:`,
              chainRelayer,
            )

            const { opHash } = await chainRelayer.sendMetaTxn(
              metaTxn.walletAddress as Address.Address,
              metaTxn.contract as Address.Address,
              metaTxn.input as Hex,
              BigInt(metaTxn.chainId),
              undefined,
              relevantPreconditions,
            )

            results.push({
              operationKey,
              opHash,
              success: true,
            })
          } catch (error: any) {
            results.push({
              operationKey,
              error: error.message,
              success: false,
            })
          }
        }

        return results
      } catch (error: any) {
        throw error
      }
    },
    onSuccess: (results) => {
      // Update states based on results
      results.forEach(({ operationKey, opHash, success }) => {
        if (success && opHash) {
          setSentMetaTxns((prev) => ({
            ...prev,
            [operationKey]: Date.now(),
          }))
        }
      })
    },
    onError: (error) => {
      console.error('Error in meta-transaction process:', error)
    },
    retry: 5, // Allow up to 2 retries
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000), // Exponential backoff
  })

  // Replace the sendMetaTxn function with a wrapper that uses the mutation
  const sendMetaTxn = (selectedId: string | null) => {
    sendMetaTxnMutation.mutate({ selectedId })
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto min-h-screen">
      <div className="text-center mb-8 animate-fadeIn">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
          Sequence Anypay Demo
        </h1>
        <p className="text-gray-300 text-sm">Connect your wallet and explore cross-chain intents</p>
      </div>

      {/* Account Info & Connect/Disconnect - Standalone Card */}
      <SectionHeader
        className="bg-gray-800/80 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm transition-all duration-300 hover:shadow-blue-900/20 mb-6"
        titleContainerClassName="p-6 flex items-center justify-between w-full"
        contentContainerClassName="p-6 pt-0"
        title={
          <div className="flex items-center">
            <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
              <span>1</span>
            </div>
            <h3 className="text-xl font-semibold text-white">Account</h3>
          </div>
        }
        statusPill={
          <div className="px-3 py-1 rounded-full bg-gray-700/50 text-gray-300 text-sm flex items-center">
            <span
              className={`w-2 h-2 rounded-full ${account.status === 'connected' ? 'bg-green-400' : 'bg-yellow-400'} mr-2 animate-pulse`}
            ></span>
            {account.status === 'connected' ? 'Connected' : 'Disconnected'}
          </div>
        }
      >
        {account.status === 'connected' ? (
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/30 space-y-2 mt-4">
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
      </SectionHeader>

      {/* Main Workflow Card - Container for Steps 2-6 */}
      {account.status === 'connected' && (
        <div className="bg-gray-800/80 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm space-y-6 transition-all duration-300 hover:shadow-blue-900/20 mb-6">
          {/* Step 2: Select Origin Token */}
          <SectionHeader
            noFrame={true} // Part of the larger card, so no individual frame
            titleContainerClassName="px-6 pt-6 pb-4 flex items-center justify-between w-full"
            contentContainerClassName="px-6 pb-4" // Padding for the content area
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
                {isLoadingBalances
                  ? 'Loading...'
                  : sortedTokens.length > 0
                    ? `${sortedTokens.length} Tokens`
                    : 'No Tokens'}
              </div>
            }
          >
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
                      setIntentCallsPayloads(null)
                      setIntentPreconditions(null)
                      setMetaTxns(null)
                      setCommittedIntentAddress(null)
                      setVerificationStatus(null)
                      setHasAutoExecuted(false)
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
          </SectionHeader>

          {/* Step 3: Choose Action */}
          <SectionHeader
            noFrame={true}
            titleContainerClassName="px-6 pb-4 flex items-center justify-between w-full"
            contentContainerClassName="px-6 pb-4 flex flex-col gap-4"
            isCollapsible={false}
            title={
              <div className="flex items-center">
                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                  <span>3</span>
                </div>
                <h3 className="text-xl font-semibold text-white">Choose Action</h3>
              </div>
            }
          >
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
                        (Donate 0.30 $USDC)
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
          </SectionHeader>

          {/* Step 4: Intent Quote Display */}
          {createIntentMutation.isPending && (
            <div className="px-6 pb-6">
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 animate-pulse">
                <div className="flex items-center text-center">
                  <Loader2 className="animate-spin h-4 w-4 mr-2 text-yellow-500" />
                  <Text variant="small" color="warning">
                    Generating intent quote...
                  </Text>
                </div>
              </div>
            </div>
          )}
          {createIntentMutation.isError && (
            <div className="px-6 pb-6">
              <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                <Text variant="small" color="negative" className="break-words flex items-center text-center">
                  <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>Error: {createIntentMutation.error.message}</span>
                </Text>
              </div>
            </div>
          )}
          {intentCallsPayloads && (
            <SectionHeader
              noFrame={true}
              titleContainerClassName="px-6 pt-4 pb-4 flex items-center justify-between w-full hover:bg-gray-700/60 rounded-md"
              contentContainerClassName="px-6 pb-4 border-t border-gray-700/30"
              isCollapsible={true}
              defaultOpen={false}
              title={
                <div className="flex items-center">
                  <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                    <span>4</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Intent Quote</h3>
                </div>
              }
              actionSubtitle={(() => {
                let primarySubtitleNode: React.ReactNode = null
                const currentAction = createIntentMutation.variables

                if (intentCallsPayloads && currentAction && selectedToken) {
                  if (currentAction === 'pay') {
                    const baseChainInfo = getChainInfo(BASE_USDC_DESTINATION_CHAIN_ID)
                    const baseChainName = baseChainInfo?.name || `Chain ID ${BASE_USDC_DESTINATION_CHAIN_ID}`
                    primarySubtitleNode = (
                      <>
                        <Zap className="h-3.5 w-3.5 mr-1.5 text-purple-400 flex-shrink-0" />
                        Intent: Send <strong className="text-gray-200 mx-1">{formatUnits(AMOUNT, 6)} USDC</strong>
                        to{' '}
                        <strong
                          className="text-gray-200 font-mono mx-1 truncate max-w-[100px]"
                          title={RECIPIENT_ADDRESS}
                        >
                          {RECIPIENT_ADDRESS}
                        </strong>
                        on <strong className="text-gray-200 mx-1">{baseChainName}</strong>
                      </>
                    )
                  } else if (currentAction === 'mock_interaction') {
                    const mockChainInfo = getChainInfo(MOCK_CHAIN_ID)
                    const mockChainName = mockChainInfo?.name || `Chain ID ${MOCK_CHAIN_ID}`
                    primarySubtitleNode = (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-yellow-400 flex-shrink-0" />
                        Intent: Target{' '}
                        <strong
                          className="text-gray-200 font-mono mx-1 truncate max-w-[70px]"
                          title={MOCK_CONTRACT_ADDRESS}
                        >
                          {MOCK_CONTRACT_ADDRESS}
                        </strong>
                        on <strong className="text-gray-200 mx-1">{mockChainName}</strong>.
                        {(MOCK_TOKEN_ADDRESS || MOCK_TOKEN_AMOUNT) && (
                          <span className="ml-1">
                            (Token:{' '}
                            <strong
                              className="text-gray-200 font-mono mx-1 truncate max-w-[70px]"
                              title={MOCK_TOKEN_ADDRESS || 'N/A'}
                            >
                              {MOCK_TOKEN_ADDRESS || 'N/A'}
                            </strong>
                            , Amount: <strong className="text-gray-200 mx-1">{MOCK_TOKEN_AMOUNT || 'N/A'} wei</strong>)
                          </span>
                        )}
                      </>
                    )
                  } else if (currentAction === 'custom_call') {
                    const destChainId = parseInt(customCallData.chainId)
                    const destChainInfo = getChainInfo(destChainId)
                    const destChainName = destChainInfo?.name || `Chain ID ${destChainId}`
                    const formattedVal = formatUnits(
                      BigInt(customCallData.value || '0'),
                      destChainInfo?.nativeCurrency.decimals || 18,
                    )
                    const nativeSymbol = destChainInfo?.nativeCurrency.symbol || 'ETH'

                    primarySubtitleNode = (
                      <>
                        <PenSquare className="h-3.5 w-3.5 mr-1.5 text-green-400 flex-shrink-0" />
                        Intent: Call{' '}
                        <strong
                          className="text-gray-200 font-mono mx-1 truncate max-w-[70px]"
                          title={customCallData.to}
                        >
                          {customCallData.to}
                        </strong>
                        on <strong className="text-gray-200 mx-1">{destChainName}</strong>.
                        {BigInt(customCallData.value || '0') > 0 && (
                          <span className="ml-1">
                            (Value:{' '}
                            <strong className="text-gray-200 mx-1">
                              {formattedVal} {nativeSymbol}
                            </strong>
                            )
                          </span>
                        )}
                      </>
                    )
                  }
                }
                return primarySubtitleNode
              })()}
              subtitle={(() => {
                let routeSubtitleNode: React.ReactNode = null
                const currentAction = createIntentMutation.variables

                if (
                  intentCallsPayloads &&
                  currentAction &&
                  selectedToken &&
                  account.address &&
                  lifiInfos &&
                  intentPreconditions
                ) {
                  const tokenName = selectedToken.contractInfo?.symbol || selectedToken.contractInfo?.name || 'Token'
                  const originChainInfo = getChainInfo(selectedToken.chainId)
                  const originChainName = originChainInfo?.name || `Chain ID ${selectedToken.chainId}`
                  let amountToSendFormatted = '[Amount Error]'

                  try {
                    const isNative = selectedToken.contractAddress === zeroAddress
                    let amountBigInt: bigint | undefined = undefined
                    let decimals: number | undefined = undefined

                    if (isNative) {
                      const nativePrecondition = intentPreconditions.find(
                        (p) =>
                          (p.type === 'transfer-native' || p.type === 'native-balance') &&
                          p.chainId === selectedToken.chainId.toString(),
                      )
                      const nativeMinAmount = nativePrecondition?.data?.minAmount ?? nativePrecondition?.data?.min
                      if (nativeMinAmount !== undefined) {
                        amountBigInt = BigInt(nativeMinAmount)
                        decimals = selectedToken.contractInfo?.decimals || 18
                      }
                    } else {
                      const erc20Precondition = intentPreconditions.find(
                        (p) =>
                          p.type === 'erc20-balance' &&
                          p.chainId === selectedToken.chainId.toString() &&
                          p.data?.token &&
                          isAddressEqual(Address.from(p.data.token), Address.from(selectedToken.contractAddress)),
                      )
                      const erc20MinAmount = erc20Precondition?.data?.min
                      if (erc20MinAmount !== undefined) {
                        amountBigInt = BigInt(erc20MinAmount)
                        decimals = selectedToken.contractInfo?.decimals
                      }
                    }

                    if (amountBigInt !== undefined && decimals !== undefined) {
                      amountToSendFormatted = formatUnits(amountBigInt, decimals)
                    } else {
                      console.warn('Could not determine amount to send from preconditions for subtitle.')
                      amountToSendFormatted = '[Unknown Amount]'
                    }

                    const calculatedIntentAddress = calculateIntentAddress(
                      account.address,
                      intentCallsPayloads,
                      lifiInfos,
                    ).toString()

                    routeSubtitleNode = (
                      <>
                        <Info className="h-3.5 w-3.5 mr-1.5 text-sky-400 flex-shrink-0" />
                        <span>
                          Via route: Sending{' '}
                          <strong className="text-gray-200 mx-1">
                            {amountToSendFormatted} {tokenName}
                          </strong>
                          on <strong className="text-gray-200 mx-1">{originChainName}</strong> to intent addr:
                          <strong
                            className="text-gray-200 font-mono mx-1 truncate max-w-[70px] sm:max-w-[100px] inline-block align-bottom"
                            title={calculatedIntentAddress}
                          >
                            {calculatedIntentAddress}
                          </strong>
                        </span>
                      </>
                    )
                  } catch (routeError) {
                    console.error('Error processing route subtitle data:', routeError)
                    routeSubtitleNode = (
                      <span className="flex items-center text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                        Error generating route summary.
                      </span>
                    )
                  }
                }
                return routeSubtitleNode
              })()}
            >
              <div className="text-xs text-gray-300 bg-gray-900/90 p-4 mt-2 rounded-lg border-t border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
                <Text
                  variant="medium"
                  color="primary"
                  className="mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Intent all payloads
                  <Text variant="small" color="secondary" className="ml-1">
                    (List of all payloads that are pre-authorized to be executed):
                  </Text>
                </Text>

                {/* Intent call payloads Section */}
                {intentCallsPayloads && intentCallsPayloads.length > 0 ? (
                  <div className="space-y-2">
                    {/* Raw JSON View */}
                    <div className="bg-gray-800/70 p-3 rounded-md mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <Text variant="small" color="primary" className="font-semibold flex items-center">
                          <Clipboard className="h-4 w-4 mr-2" />
                          Raw JSON Data
                        </Text>
                      </div>
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-gray-900/50 p-2 rounded border border-gray-700/50 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                        {JSON.stringify(intentCallsPayloads, null, 2)}
                      </pre>
                    </div>
                    {intentCallsPayloads.map((operation, index) => (
                      <div
                        key={`operation-${index}`}
                        className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50"
                      >
                        <div className="pb-2">
                          <Text variant="small" color="primary" className="font-semibold">
                            Payload #{index + 1}
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
                      {/* Raw JSON View */}
                      <div className="bg-gray-800/70 p-3 rounded-md mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <Text variant="small" color="primary" className="font-semibold flex items-center">
                            <Clipboard className="h-4 w-4 mr-2" />
                            Raw JSON Data
                          </Text>
                        </div>
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-gray-900/50 p-2 rounded border border-gray-700/50 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                          {JSON.stringify(metaTxns, null, 2)}
                        </pre>
                      </div>
                      {metaTxns.map((tx, index) => (
                        <div
                          key={`metatx-${index}`}
                          className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50"
                        >
                          <div className="space-y-2">
                            <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                              <Text variant="small" color="secondary">
                                <strong className="text-blue-300">ID: </strong>
                                <span className="font-mono text-yellow-300 break-all">{tx.id || 'N/A'}</span>
                              </Text>
                            </div>
                            <div className="bg-gray-800/70 p-2 rounded-md mb-1">
                              <Text variant="small" color="secondary">
                                <strong className="text-blue-300">Contract: </strong>
                                <span className="font-mono text-yellow-300 break-all">{tx.contract || 'N/A'}</span>
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

                {/* Lifi Infos Section */}
                {lifiInfos && lifiInfos.length > 0 && (
                  <div className="mt-4">
                    <Text
                      variant="medium"
                      color="primary"
                      className="mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                    >
                      <Info className="h-4 w-4 mr-1" /> {/* Using Info icon as a placeholder, can be changed */}
                      Lifi Infos
                      <Text variant="small" color="secondary" className="ml-1">
                        (Details from Lifi integration):
                      </Text>
                    </Text>
                    <div className="space-y-2">
                      {/* Raw JSON View */}
                      <div className="bg-gray-800/70 p-3 rounded-md mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <Text variant="small" color="primary" className="font-semibold flex items-center">
                            <Clipboard className="h-4 w-4 mr-2" />
                            Raw JSON Data
                          </Text>
                        </div>
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-gray-900/50 p-2 rounded border border-gray-700/50 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                          {JSON.stringify(lifiInfos, null, 2)}
                        </pre>
                      </div>
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
            </SectionHeader>
          )}

          {/* Fallback for Intent Quote section when nothing else is shown */}
          {!createIntentMutation.isPending && !createIntentMutation.isError && !intentCallsPayloads && (
            <div className="px-6 pb-6">
              {' '}
              {/* Added pb-6 for bottom padding */}
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-4 flex items-center justify-center">
                <Text variant="small" color="secondary" className="flex flex-col items-center text-center">
                  <ShieldCheck className="h-10 w-10 text-gray-600 mb-2" />
                  Select a token and click an action above to generate the intent quote.
                </Text>
              </div>
            </div>
          )}

          {/* Step 5: Commit Intent */}
          {intentCallsPayloads && intentPreconditions && (
            <>
              <SectionHeader
                noFrame={true}
                titleContainerClassName="px-6 pt-4 pb-4 flex items-center justify-between w-full hover:bg-gray-700/60 rounded-md"
                contentContainerClassName="px-6 pb-4 border-t border-gray-700/30"
                isCollapsible={true}
                defaultOpen={false}
                title={
                  <div className="flex items-center">
                    <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                      <span>5</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white">Commit Intent</h3>
                  </div>
                }
              >
                {/* Content for Commit Intent Details Accordion */}
                <div className="text-xs text-gray-300 bg-gray-900/90 p-4 mt-2 rounded-lg border-t border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
                  <div className="flex flex-col space-y-4">
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
                                Calculated:{/* */}
                                <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
                                  {verificationStatus.calculatedAddress || 'N/A'}
                                </span>
                              </div>
                              <div>
                                Expected (from precondition):{/* */}
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
                          Intent configuration committed successfully!
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
                            <Text
                              variant="small"
                              color="negative"
                              className="break-words flex items-center text-center"
                            >
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
              </SectionHeader>
              {/* Commit Button remains outside the accordion */}
              <div className="px-6 pt-4">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/30">
                  <div className="flex items-center justify-between">
                    <Text
                      variant="medium"
                      color="primary"
                      className="mb-2 pb-1 border-b border-gray-700/50 flex items-center"
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Commit Intent Action
                      <Text variant="small" color="secondary" className="ml-1">
                        (Verify and Send Transaction)
                      </Text>
                    </Text>
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!account.address || !intentCallsPayloads || !intentPreconditions || !lifiInfos) return
                        commitIntentConfigMutation.mutate({
                          walletAddress: calculateIntentAddress(
                            account.address,
                            intentCallsPayloads,
                            lifiInfos,
                          ).toString(),
                          mainSigner: account.address,
                          calls: intentCallsPayloads,
                          preconditions: intentPreconditions,
                          lifiInfos: lifiInfos,
                        })
                      }}
                      disabled={isCommitButtonDisabled}
                      className="px-2.5 py-1 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {commitButtonText}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 6: Origin Call */}
          {intentCallsPayloads && intentPreconditions && (
            <SectionHeader
              noFrame={true}
              titleContainerClassName="px-6 pt-4 pb-4 flex items-center justify-between w-full"
              contentContainerClassName="px-6 pb-6"
              isCollapsible={false}
              title={
                <div className="flex items-center">
                  <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                    <span>6</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Origin Call</h3>
                </div>
              }
            >
              <div className="text-xs text-gray-300 bg-gray-900/90 p-4 rounded-lg border-t border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
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
            </SectionHeader>
          )}

          {/* Container for Preview Calculated Address and Manual Meta Txn Controls */}
          {account.address && intentCallsPayloads && (
            <div className="px-6 space-y-6 pb-6">
              {' '}
              {/* Outer container for padding and spacing */}
              {/* Preview calculated address */}
              <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 shadow-inner space-y-3">
                <Text variant="small" color="secondary">
                  <strong className="text-blue-300">Calculated Intent Address: </strong>
                  <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
                    {(intentCallsPayloads && account.address && lifiInfos
                      ? calculateIntentAddress(account.address, intentCallsPayloads, lifiInfos)?.toString()
                      : null) || 'N/A'}
                  </span>
                </Text>
                {intentCallsPayloads && account.address && lifiInfos && metaTxns && metaTxns.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2">
                    {' '}
                    {/* Added space-y-2 for link items */}
                    <Text variant="small" color="secondary" className="mb-1 text-blue-300 font-semibold">
                      Open Intent Address in Explorer:
                    </Text>
                    <div className="flex flex-col space-y-1">
                      {[...new Set(metaTxns.map((tx) => tx.chainId))]
                        .map((chainIdStr) => parseInt(chainIdStr))
                        .map((chainId) => {
                          const actualIntentConfigAddress = calculateIntentAddress(
                            account.address!,
                            intentCallsPayloads!,
                            lifiInfos!,
                          )?.toString()
                          if (!actualIntentConfigAddress) return null
                          const explorerUrl = getExplorerUrl(chainId, actualIntentConfigAddress)
                          const chainInfo = getChainInfo(chainId)
                          if (!explorerUrl) return null
                          return (
                            <div key={`${chainId}-explorer-link-intent`} className="bg-gray-800/70 p-2 rounded-md">
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open ${actualIntentConfigAddress} on ${chainInfo?.name || 'explorer'}`}
                                className="text-gray-300 flex items-center space-x-1 hover:underline text-xs break-all"
                              >
                                <NetworkImage chainId={chainId} size="xs" className="w-3 h-3" />
                                <span>{explorerUrl}</span>
                              </a>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
                {intentCallsPayloads && createIntentMutation.variables && (
                  <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2">
                    <Text variant="small" color="secondary" className="mb-1 text-blue-300 font-semibold">
                      Open in Explorer: (Final Destination Address)
                    </Text>
                    <div className="flex flex-col space-y-1">
                      {(() => {
                        const currentAction = createIntentMutation.variables
                        let finalDestAddress: string | undefined = undefined
                        let finalDestChainId: number | undefined = undefined
                        let labelPrefix = 'Final Destination Address'

                        if (currentAction === 'pay') {
                          finalDestAddress = RECIPIENT_ADDRESS
                          finalDestChainId = BASE_USDC_DESTINATION_CHAIN_ID
                          labelPrefix = 'Final Donation Address'
                        } else if (currentAction === 'mock_interaction') {
                          finalDestAddress = MOCK_CONTRACT_ADDRESS
                          finalDestChainId = MOCK_CHAIN_ID
                          labelPrefix = 'Mock Target Address'
                        } else if (currentAction === 'custom_call') {
                          finalDestAddress = customCallData.to
                          finalDestChainId = customCallData.chainId ? parseInt(customCallData.chainId) : undefined
                          labelPrefix = 'Custom Call Target Address'
                        }

                        if (finalDestAddress && finalDestChainId !== undefined) {
                          const explorerUrl = getExplorerUrl(finalDestChainId, finalDestAddress)
                          const chainInfo = getChainInfo(finalDestChainId)
                          if (!explorerUrl)
                            return (
                              <Text variant="small" color="secondary">
                                Explorer URL not available for this destination.
                              </Text>
                            )

                          return (
                            <div className="bg-gray-800/70 p-2 rounded-md">
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`View ${labelPrefix.toLowerCase()} ${finalDestAddress} on ${chainInfo?.name || 'explorer'}`}
                                className="text-gray-300 flex items-center space-x-1 hover:underline text-xs break-all"
                              >
                                <NetworkImage chainId={finalDestChainId} size="xs" className="w-3 h-3" />
                                <span>{explorerUrl}</span>
                              </a>
                            </div>
                          )
                        }
                        return (
                          <Text variant="small" color="secondary">
                            Final destination details not available for this action.
                          </Text>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
              {/* Manual Meta Transaction Controls */}
              <div className="bg-gray-900/50 p-4 rounded-lg border border-purple-700/30">
                <div className="flex items-center justify-between mb-4">
                  <Text variant="medium" color="primary" className="flex items-center">
                    <Layers className="h-4 w-4 mr-2" />
                    Manual Meta Transaction Controls
                  </Text>
                  <div className="flex items-center space-x-2">
                    <Text variant="small" color="secondary">
                      {isManualMetaTxnEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <div
                      onClick={() => setIsManualMetaTxnEnabled(!isManualMetaTxnEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        isManualMetaTxnEnabled ? 'bg-purple-600' : 'bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isManualMetaTxnEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </div>
                </div>
                {isManualMetaTxnEnabled && (
                  <div className="mt-2 space-y-4">
                    {/* Meta Transaction Selection */}
                    <div className="bg-gray-800/70 p-3 rounded-md">
                      <Text variant="small" color="secondary" className="mb-2">
                        Select Meta Transaction:
                      </Text>
                      <div className="space-y-2">
                        {metaTxns?.map((tx, index) => (
                          <div
                            key={tx.id}
                            onClick={() => setSelectedMetaTxnId(tx.id)}
                            className={`p-2 rounded-md cursor-pointer transition-all duration-200 ${
                              selectedMetaTxnId === tx.id
                                ? 'bg-purple-900/50 border border-purple-500'
                                : 'bg-gray-700/50 border border-gray-600 hover:bg-gray-600/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <NetworkImage chainId={parseInt(tx.chainId)} size="sm" className="w-4 h-4" />
                                <Text variant="small" color="secondary">
                                  #{index + 1} - Chain {tx.chainId}
                                </Text>
                              </div>
                              <Text variant="small" color="secondary" className="font-mono text-xs">
                                ID: {tx.id}
                              </Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="feature"
                        onClick={() => sendMetaTxn(selectedMetaTxnId)}
                        disabled={
                          !metaTxns || metaTxns.length === 0 || !account.address || sendMetaTxnMutation.isPending
                        }
                        className="flex-1 px-4 py-2 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center bg-purple-600 hover:bg-purple-700"
                      >
                        {sendMetaTxnMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Layers className="h-4 w-4 mr-2" />
                            {selectedMetaTxnId ? 'Send Selected Meta Transaction' : 'Send All Meta Transactions'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex items-center">
                  <Text variant="small" color="secondary" className="text-center">
                    <Info className="h-4 w-4 inline mr-1" />
                    {selectedMetaTxnId
                      ? 'This will send only the selected meta transaction'
                      : 'This will send all meta transactions in sequence'}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Relayer Status Card - Standalone Card - Visible when account is connected */}
      {account.status === 'connected' && (
        <SectionHeader
          className="bg-gray-800/80 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm transition-all duration-300 hover:shadow-blue-900/20 mb-6"
          titleContainerClassName="p-6 flex items-center justify-between w-full"
          contentContainerClassName="p-6 pt-0"
          isCollapsible={false}
          title={
            <div className="flex items-center">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
                <span>7</span>
              </div>
              <h3 className="text-xl font-semibold text-white">Relayer Status</h3>
            </div>
          }
        >
          <div className="space-y-6 mt-4">
            {' '}
            {/* Added mt-4 to space content from header */}
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
                      {originCallStatus?.txnHash || 'Not sent yet'}
                    </span>
                  </Text>
                </div>
                <div className="bg-gray-800/70 p-3 rounded-md">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Status: </strong>
                    <span
                      className={`font-mono ${
                        originCallStatus?.status === 'Success'
                          ? 'text-green-400'
                          : originCallStatus?.status === 'Failed'
                            ? 'text-red-400'
                            : originCallStatus?.status === 'Pending' || originCallStatus?.status === 'Sending...'
                              ? 'text-yellow-400'
                              : 'text-gray-400'
                      }`}
                    >
                      {originCallStatus?.status || 'Idle'}
                    </span>
                    {isWaitingForReceipt && <span className="text-yellow-400 ml-1">(Waiting for confirmation...)</span>}
                  </Text>
                </div>
                {originCallStatus?.revertReason && (
                  <div className="bg-gray-800/70 p-3 rounded-md">
                    <Text variant="small" color="secondary" className="break-all">
                      <strong className="text-blue-300">Revert Reason: </strong>
                      <span className="font-mono text-red-300">{originCallStatus.revertReason}</span>
                    </Text>
                  </div>
                )}
                <div className="bg-gray-800/70 p-3 rounded-md">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Gas Used: </strong>
                    <span className="font-mono">{originCallStatus?.gasUsed || '0'}</span>
                  </Text>
                </div>
                <div className="bg-gray-800/70 p-3 rounded-md">
                  <Text variant="small" color="secondary">
                    <strong className="text-blue-300">Effective Gas Price: </strong>
                    <span className="font-mono">{originCallStatus?.effectiveGasPrice || '0'}</span>
                  </Text>
                </div>
              </div>
            </div>
            {/* Preconditions Status */}
            {/* <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto shadow-inner">
              <Text
                variant="medium"
                color="primary"
                className="mb-4 pb-2 border-b border-gray-700/50 flex items-center"
              >
                <Clipboard className="h-4 w-4 mr-2" />
                Preconditions Status
              </Text>
              <div className="space-y-3">
                {intentPreconditions && intentPreconditions.length > 0 ? (
                  intentPreconditions.map((precondition, index) => (
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
                  ))
                ) : (
                  <div className="bg-gray-800/70 p-3 rounded-md">
                    <Text variant="small" color="secondary" className="text-center">
                      No preconditions available yet. Select a token and action first.
                    </Text>
                  </div>
                )}
              </div>
            </div> */}
            {/* Meta Transactions Status */}
            <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto shadow-inner">
              <Text
                variant="medium"
                color="primary"
                className="mb-4 pb-2 border-b border-gray-700/50 flex items-center"
              >
                <Box className="h-4 w-4 mr-2" />
                Meta Transactions Status
              </Text>
              <div className="space-y-4">
                {metaTxns?.map((metaTxn, index) => {
                  const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
                  const monitorStatus = metaTxnMonitorStatuses[operationKey]
                  const typedMetaTxn = metaTxn as unknown as MetaTxn

                  const getStatusDisplay = () => {
                    if (!monitorStatus) return 'Pending'
                    switch (monitorStatus.status) {
                      case 'confirmed':
                        return 'Success'
                      case 'failed':
                        return 'Failed'
                      case 'unknown':
                        return 'Unknown'
                      default:
                        return 'Pending'
                    }
                  }

                  const getStatusClass = () => {
                    if (!monitorStatus) return 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
                    switch (monitorStatus.status) {
                      case 'confirmed':
                        return 'bg-green-900/30 text-green-400 border border-green-700/30'
                      case 'failed':
                        return 'bg-red-900/30 text-red-400 border border-red-700/30'
                      default:
                        return 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
                    }
                  }

                  return (
                    <div key={`metatx-${index}`} className="bg-gray-800/70 p-3 rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Text variant="small" color="primary" className="font-semibold flex items-center">
                          <NetworkImage chainId={parseInt(typedMetaTxn.chainId)} size="sm" className="w-4 h-4 mr-2" />
                          Meta Transaction #{index + 1} - Chain {typedMetaTxn.chainId}
                          <span className="text-gray-400 text-xs ml-2">
                            ({getChainInfo(parseInt(typedMetaTxn.chainId))?.name || 'Unknown Chain'})
                          </span>
                        </Text>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass()}`}>
                          {getStatusDisplay()}
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        <div>
                          <Text variant="small" color="secondary">
                            <strong className="text-blue-300">ID: </strong>
                            <span className="font-mono text-yellow-300 break-all">{typedMetaTxn.id || 'N/A'}</span>
                          </Text>
                        </div>
                        {monitorStatus?.status === 'confirmed' && monitorStatus && 'txHash' in monitorStatus && (
                          <Text variant="small" color="secondary">
                            <strong className="text-blue-300">Tx Hash: </strong>
                            <span className="font-mono text-yellow-300 break-all">{String(monitorStatus.txHash)}</span>
                          </Text>
                        )}
                        {monitorStatus?.status === 'confirmed' &&
                          monitorStatus &&
                          monitorStatus.receipt &&
                          'txnHash' in monitorStatus.receipt &&
                          typeof monitorStatus.receipt.txnHash === 'string' &&
                          monitorStatus.receipt.txnHash && (
                            <Text variant="small" color="secondary">
                              <strong className="text-blue-300">Explorer: </strong>
                              <a
                                href={
                                  getExplorerTransactionUrl(
                                    parseInt(typedMetaTxn.chainId),
                                    monitorStatus.receipt.txnHash,
                                  ) || '#'
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-purple-400 hover:underline break-all"
                              >
                                {getExplorerTransactionUrl(
                                  parseInt(typedMetaTxn.chainId),
                                  monitorStatus.receipt.txnHash,
                                )}
                              </a>
                            </Text>
                          )}
                        {monitorStatus?.status === 'failed' && monitorStatus && 'reason' in monitorStatus && (
                          <Text variant="small" color="negative">
                            <strong className="text-red-300">Error: </strong>
                            <span className="font-mono break-all">{String(monitorStatus.reason)}</span>
                          </Text>
                        )}
                        {monitorStatus?.status === 'confirmed' &&
                          monitorStatus &&
                          monitorStatus.receipt &&
                          'gasUsed' in monitorStatus.receipt &&
                          typeof monitorStatus.receipt.gasUsed === 'bigint' && (
                            <Text variant="small" color="secondary">
                              <strong className="text-blue-300">Gas Used: </strong>
                              <span className="font-mono">{monitorStatus.receipt.gasUsed}</span>
                            </Text>
                          )}
                        {(monitorStatus?.status === 'confirmed' || monitorStatus?.status === 'failed') &&
                          monitorStatus && (
                            <div className="mt-2 bg-gray-900/50 p-2 rounded border border-gray-700/50">
                              <Text variant="small" color="secondary" className="font-semibold mb-1">
                                Meta Transaction Status Details:
                              </Text>
                              <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap bg-gray-800/70 p-2 text-gray-300 rounded-md max-h-60 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                                {JSON.stringify(
                                  monitorStatus,
                                  (_, value) => (typeof value === 'bigint' ? value.toString() : value),
                                  2,
                                )}
                              </pre>
                            </div>
                          )}
                      </div>
                    </div>
                  )
                })}
                {(!metaTxns || metaTxns.length === 0) && (
                  <div className="bg-gray-800/70 p-3 rounded-md">
                    <Text variant="small" color="secondary" className="text-center">
                      No meta transactions available yet. Select a token and action first.
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionHeader>
      )}
    </div>
  )
}
