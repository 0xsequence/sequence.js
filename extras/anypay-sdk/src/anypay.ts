import { useState, useEffect, useMemo } from 'react'
import { useSendTransaction, useSwitchChain, useEstimateGas } from 'wagmi'
import {
  GetIntentCallsPayloadsReturn,
  IntentCallsPayload,
  IntentPrecondition,
  GetIntentConfigReturn,
  AnypayLifiInfo,
  GetIntentCallsPayloadsArgs,
  SequenceAPIClient
} from '@0xsequence/api'
import { useQuery, useMutation, UseMutationResult } from '@tanstack/react-query'
import { useWaitForTransactionReceipt } from 'wagmi'
import { Address } from 'ox'
import { Hex, isAddressEqual, zeroAddress } from 'viem'
import { useAPIClient } from './apiClient'
import { useMetaTxnsMonitor, MetaTxn } from './metaTxnMonitor'
import { useRelayers } from './relayer'
import { findPreconditionAddress } from './preconditions'
import { calculateIntentAddress, OriginCallParams } from './intents'
import { getERC20TransferData } from './encoders'
import { RelayerOperationStatus } from './relayer'

export type Account = {
  address: `0x${string}`
  isConnected: boolean
  chainId: number
}

export type UseAnypayConfig = {
  account: Account
  disableAutoExecute?: boolean
  env: 'local' | 'cors-anywhere' | 'dev' | 'prod'
  useV3Relayers?: boolean
}

export type UseAnypayReturn = {
  apiClient: SequenceAPIClient
  metaTxns: GetIntentCallsPayloadsReturn['metaTxns'] | null
  intentCallsPayloads: GetIntentCallsPayloadsReturn['calls'] | null
  intentPreconditions: GetIntentCallsPayloadsReturn['preconditions'] | null
  lifiInfos: GetIntentCallsPayloadsReturn['lifiInfos'] | null
  txnHash: Hex | undefined
  committedIntentAddress: string | null
  verificationStatus: {
    success: boolean
    receivedAddress?: string
    calculatedAddress?: string
  } | null
  getRelayer: (chainId: number) => any // TODO: Add proper type
  estimatedGas: bigint | undefined
  isEstimateError: boolean
  estimateError: Error | null
  calculateIntentAddress: typeof calculateIntentAddress
  committedIntentConfig: GetIntentConfigReturn | undefined
  isLoadingCommittedConfig: boolean
  committedConfigError: Error | null
  commitIntentConfig: (args: any) => void // TODO: Add proper type
  commitIntentConfigPending: boolean
  commitIntentConfigSuccess: boolean
  commitIntentConfigError: Error | null
  commitIntentConfigArgs: any // TODO: Add proper type
  getIntentCallsPayloads: (
    args: GetIntentCallsPayloadsArgs
  ) => Promise<GetIntentCallsPayloadsReturn>
  operationHashes: { [key: string]: Hex }
  callIntentCallsPayload: (args: any) => void // TODO: Add proper type
  sendOriginTransaction: () => Promise<void>
  switchChain: any // TODO: Add proper type
  isSwitchingChain: boolean
  switchChainError: Error | null
  isTransactionInProgress: boolean
  isChainSwitchRequired: boolean
  sendTransaction: any // Update type to match the actual sendTransaction function
  isSendingTransaction: boolean
  originCallStatus: {
    txnHash?: string
    status?: string
    revertReason?: string | null
    gasUsed?: number
    effectiveGasPrice?: string
  } | null
  updateOriginCallStatus: (
    hash: Hex | undefined,
    status: 'success' | 'reverted' | 'pending' | 'sending',
    gasUsed?: bigint,
    effectiveGasPrice?: bigint,
    revertReason?: string | null
  ) => void
  isEstimatingGas: boolean
  isAutoExecute: boolean
  updateAutoExecute: (enabled: boolean) => void
  receipt: any // TODO: Add proper type
  isWaitingForReceipt: boolean
  receiptIsSuccess: boolean
  receiptIsError: boolean
  receiptError: Error | null
  hasAutoExecuted: boolean
  sentMetaTxns: { [key: string]: number }
  sendMetaTxn: (selectedId: string | null) => void
  sendMetaTxnPending: boolean
  sendMetaTxnSuccess: boolean
  sendMetaTxnError: Error | null
  sendMetaTxnArgs: { selectedId: string | null } | undefined
  clearIntent: () => void
  metaTxnMonitorStatuses: { [key: string]: RelayerOperationStatus }
  createIntent: (args: any) => void // TODO: Add proper type
  createIntentPending: boolean
  createIntentSuccess: boolean
  createIntentError: Error | null
  createIntentArgs: any // TODO: Add proper type
  calculatedIntentAddress: Address.Address | null
  originCallParams: OriginCallParams | null
  updateOriginCallParams: (args: { originChainId: number; tokenAddress: string } | null) => void
}

const RETRY_WINDOW_MS = 10_000

export function useAnyPay(config: UseAnypayConfig): UseAnypayReturn {
  const { account, disableAutoExecute = false, env, useV3Relayers } = config
  const apiClient = useAPIClient()

  const [isAutoExecute, setIsAutoExecute] = useState(!disableAutoExecute)
  const [hasAutoExecuted, setHasAutoExecuted] = useState(false)

  // Track timestamps of when each meta-transaction was last sent
  const [sentMetaTxns, setSentMetaTxns] = useState<{ [key: string]: number }>({})

  // State declarations
  const [metaTxns, setMetaTxns] = useState<GetIntentCallsPayloadsReturn['metaTxns'] | null>(null)
  const [intentCallsPayloads, setIntentCallsPayloads] = useState<
    GetIntentCallsPayloadsReturn['calls'] | null
  >(null)
  const [intentPreconditions, setIntentPreconditions] = useState<
    GetIntentCallsPayloadsReturn['preconditions'] | null
  >(null)
  const [lifiInfos, setLifiInfos] = useState<GetIntentCallsPayloadsReturn['lifiInfos'] | null>(null)
  const [txnHash, setTxnHash] = useState<Hex | undefined>()
  const [committedIntentAddress, setCommittedIntentAddress] = useState<string | null>(null)
  // const [preconditionStatuses, setPreconditionStatuses] = useState<boolean[]>([])

  const [originCallParams, setOriginCallParams] = useState<OriginCallParams | null>(null)

  const [operationHashes, setOperationHashes] = useState<{ [key: string]: Hex }>({})
  const [isTransactionInProgress, setIsTransactionInProgress] = useState(false)
  const [isChainSwitchRequired, setIsChainSwitchRequired] = useState(false)
  const { switchChain, isPending: isSwitchingChain, error: switchChainError } = useSwitchChain()
  const { sendTransaction, isPending: isSendingTransaction } = useSendTransaction()
  const [isEstimatingGas, setIsEstimatingGas] = useState(false)
  const [originCallStatus, setOriginCallStatus] = useState<{
    txnHash?: string
    status?: string
    revertReason?: string | null
    gasUsed?: number
    effectiveGasPrice?: string
  } | null>(null)

  const [verificationStatus, setVerificationStatus] = useState<{
    success: boolean
    receivedAddress?: string
    calculatedAddress?: string
  } | null>(null)

  const { getRelayer } = useRelayers({
    env,
    useV3Relayers
  })

  // Add gas estimation hook with proper types
  const {
    data: estimatedGas,
    isError: isEstimateError,
    error: estimateError
  } = useEstimateGas(
    originCallParams?.to && originCallParams?.chainId && !originCallParams.error
      ? {
          to: originCallParams.to || undefined,
          data: originCallParams.data || undefined,
          value: originCallParams.value || undefined,
          chainId: originCallParams.chainId || undefined
        }
      : undefined
  )

  const commitIntentConfigMutation = useMutation({
    mutationFn: async (args: {
      walletAddress: string
      mainSigner: string
      calls: IntentCallsPayload[]
      preconditions: IntentPrecondition[]
      lifiInfos: AnypayLifiInfo[]
    }) => {
      if (!apiClient) throw new Error('API client not available')
      if (!args.lifiInfos) throw new Error('LifiInfos not available')

      try {
        console.log('Calculating intent address...')
        console.log('Main signer:', args.mainSigner)
        console.log('Calls:', args.calls)
        console.log('LifiInfos:', args.lifiInfos)

        const calculatedAddress = calculateIntentAddress(
          args.mainSigner,
          args.calls,
          args.lifiInfos
        )
        const receivedAddress = findPreconditionAddress(args.preconditions)

        console.log('Calculated address:', calculatedAddress.toString())
        console.log('Received address:', receivedAddress)

        const isVerified = isAddressEqual(Address.from(receivedAddress), calculatedAddress)
        setVerificationStatus({
          success: isVerified,
          receivedAddress: receivedAddress,
          calculatedAddress: calculatedAddress.toString()
        })

        if (!isVerified) {
          throw new Error(
            'Address verification failed: Calculated address does not match received address.'
          )
        }

        // Commit the intent config
        const response = await apiClient.commitIntentConfig({
          walletAddress: calculatedAddress.toString(),
          mainSigner: args.mainSigner,
          calls: args.calls,
          preconditions: args.preconditions,
          lifiInfos: args.lifiInfos
        })
        console.log('API Commit Response:', response)
        return { calculatedAddress: calculatedAddress.toString(), response }
      } catch (error) {
        console.error('Error during commit intent mutation:', error)
        if (!verificationStatus?.success && !verificationStatus?.receivedAddress) {
          try {
            const calculatedAddress = calculateIntentAddress(
              args.mainSigner,
              args.calls,
              args.lifiInfos
            )
            const receivedAddress = findPreconditionAddress(args.preconditions)
            setVerificationStatus({
              success: false,
              receivedAddress: receivedAddress,
              calculatedAddress: calculatedAddress.toString()
            })
          } catch (calcError) {
            console.error(
              'Error calculating addresses for verification status on failure:',
              calcError
            )
            setVerificationStatus({ success: false })
          }
        }
        throw error
      }
    },
    onSuccess: data => {
      console.log('Intent config committed successfully, Wallet Address:', data.calculatedAddress)
      setCommittedIntentAddress(data.calculatedAddress)
    },
    onError: error => {
      console.error('Failed to commit intent config:', error)
      setCommittedIntentAddress(null)
    }
  })

  // New Query to fetch committed intent config
  const {
    data: committedIntentConfig,
    isLoading: isLoadingCommittedConfig,
    error: committedConfigError
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
    retry: 1
  })

  async function getIntentCallsPayloads(args: GetIntentCallsPayloadsArgs) {
    return apiClient.getIntentCallsPayloads(args)
  }

  // TODO: Add type for args
  const createIntentMutation = useMutation<
    GetIntentCallsPayloadsReturn,
    Error,
    GetIntentCallsPayloadsArgs
  >({
    mutationFn: async (args: GetIntentCallsPayloadsArgs) => {
      if (!account.address) {
        throw new Error('Missing selected token or account address')
      }
      // Reset commit state when generating a new intent
      setCommittedIntentAddress(null)
      setVerificationStatus(null)

      const data = await getIntentCallsPayloads(args)

      setMetaTxns(data.metaTxns)
      setIntentCallsPayloads(data.calls)
      setIntentPreconditions(data.preconditions)
      setLifiInfos(data.lifiInfos) // Ensure lifiInfos is set here
      setCommittedIntentAddress(null)

      setVerificationStatus(null)
      return data
    },
    onSuccess: data => {
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
    onError: error => {
      console.error('Intent Config Error:', error)
      setIntentCallsPayloads(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
      setLifiInfos(null)
    }
  })

  function callIntentCallsPayload(args: GetIntentCallsPayloadsArgs) {
    createIntentMutation.mutate(args)
  }

  useEffect(() => {
    if (!account.isConnected) {
      setIntentCallsPayloads(null)
      setIntentPreconditions(null)
      setMetaTxns(null)
      setCommittedIntentAddress(null)
      setVerificationStatus(null)
    }
  }, [account.isConnected])

  function clearIntent() {
    setIntentCallsPayloads(null)
    setIntentPreconditions(null)
    setMetaTxns(null)
    setCommittedIntentAddress(null)
    setVerificationStatus(null)
    setOperationHashes({})
    setHasAutoExecuted(false)
  }

  const updateOriginCallStatus = (
    hash: Hex | undefined,
    status: 'success' | 'reverted' | 'pending' | 'sending',
    gasUsed?: bigint,
    effectiveGasPrice?: bigint,
    revertReason?: string | null
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
      effectiveGasPrice: effectiveGasPrice?.toString()
    })
  }

  const sendOriginTransaction = async () => {
    console.log('Sending origin transaction...')
    console.log(
      isTransactionInProgress,
      originCallParams,
      originCallParams?.error,
      originCallParams?.to,
      originCallParams?.data,
      originCallParams?.value,
      originCallParams?.chainId
    )
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
      updateOriginCallStatus(
        undefined,
        'reverted',
        undefined,
        undefined,
        'Origin call parameters not ready'
      )
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
        `Switching to chain ${originCallParams.chainId}...`
      )

      try {
        console.log('Switching to chain:', originCallParams.chainId)
        await switchChain({ chainId: originCallParams.chainId })
      } catch (error: unknown) {
        console.error('Failed to switch chain:', error)
        if (
          error instanceof Error &&
          (error.message.includes('User rejected') || error.message.includes('user rejected'))
        ) {
          setIsAutoExecute(false)
        }
        updateOriginCallStatus(
          undefined,
          'reverted',
          undefined,
          undefined,
          `Failed to switch chain: ${error instanceof Error ? error.message : 'Unknown error'}`
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
          `Gas estimation failed: ${estimateError?.message}`
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
          gas: gasLimit
        },
        {
          onSuccess: (hash: Hex) => {
            console.log('Transaction sent, hash:', hash)
            setTxnHash(hash)
            setIsTransactionInProgress(false) // Reset transaction state
          },
          onError: (error: unknown) => {
            console.error('Transaction failed:', error)
            if (
              error instanceof Error &&
              (error.message.includes('User rejected') || error.message.includes('user rejected'))
            ) {
              setIsAutoExecute(false)
            }
            updateOriginCallStatus(
              undefined,
              'reverted',
              undefined,
              undefined,
              error instanceof Error ? error.message : 'Unknown error'
            )
            setIsTransactionInProgress(false)
          }
        }
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
        `Chain switch failed: ${switchChainError.message || 'Unknown error'}`
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
    isSuccess: receiptIsSuccess,
    isError: receiptIsError,
    error: receiptError
  } = useWaitForTransactionReceipt({
    hash: txnHash,
    confirmations: 1,
    query: {
      enabled: !!txnHash
    }
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
    if (originCallStatus?.txnHash === txnHash) {
      return
    }

    if (isWaitingForReceipt) {
      setOriginCallStatus({
        txnHash,
        status: 'Pending'
      })
      if (
        metaTxns &&
        metaTxns.length > 0 &&
        isAutoExecute &&
        !metaTxns.some(tx => sentMetaTxns[`${tx.chainId}-${tx.id}`])
      ) {
        console.log('Origin transaction successful, auto-sending all meta transactions...')
        // Send all meta transactions at once (pass null to send all)
        sendMetaTxnMutation.mutate({ selectedId: null })
      }

      return
    }

    if (receiptIsSuccess && receipt) {
      setOriginCallStatus({
        txnHash: receipt.transactionHash,
        status: receipt.status === 'success' ? 'Success' : 'Failed',
        gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) : undefined,
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      })
    } else if (receiptIsError) {
      setOriginCallStatus({
        txnHash,
        status: 'Failed',
        revertReason: receiptError?.message || 'Failed to get receipt'
      })
    }
  }, [
    txnHash,
    isWaitingForReceipt,
    receiptIsSuccess,
    receiptIsError,
    receipt,
    receiptError,
    metaTxns,
    sentMetaTxns,
    isAutoExecute,
    originCallStatus?.txnHash
  ])

  // Modify the auto-execute effect
  useEffect(() => {
    const shouldAutoSend =
      isAutoExecute &&
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
        status: 'Sending...'
      })

      sendTransaction(
        {
          to: originCallParams.to!,
          data: originCallParams.data!,
          value: originCallParams.value!,
          chainId: originCallParams.chainId!
        },
        {
          onSuccess: (hash: Hex) => {
            console.log('Auto-executed transaction sent, hash:', hash)
            setTxnHash(hash)
          },
          onError: (error: unknown) => {
            console.error('Auto-executed transaction failed:', error)
            if (
              error instanceof Error &&
              (error.message.includes('User rejected') || error.message.includes('user rejected'))
            ) {
              setIsAutoExecute(false)
            }
            setOriginCallStatus({
              status: 'Failed',
              revertReason: error instanceof Error ? error.message : 'Unknown error'
            })
            setHasAutoExecuted(false)
          }
        }
      )
    }
  }, [
    isAutoExecute,
    commitIntentConfigMutation.isSuccess,
    originCallParams,
    account.chainId,
    isSendingTransaction,
    isWaitingForReceipt,
    txnHash,
    isChainSwitchRequired,
    originCallStatus,
    hasAutoExecuted,
    sendTransaction
  ])

  // Effect to auto-commit when intent calls payloads are ready
  useEffect(() => {
    if (
      isAutoExecute &&
      intentCallsPayloads &&
      intentPreconditions &&
      lifiInfos &&
      account.address &&
      calculatedIntentAddress &&
      !commitIntentConfigMutation.isPending &&
      !commitIntentConfigMutation.isSuccess
    ) {
      console.log('Auto-committing intent configuration...')
      commitIntentConfigMutation.mutate({
        walletAddress: calculatedIntentAddress.toString(),
        mainSigner: account.address,
        calls: intentCallsPayloads,
        preconditions: intentPreconditions,
        lifiInfos: lifiInfos
      })
    }
  }, [
    isAutoExecute,
    intentCallsPayloads,
    intentPreconditions,
    lifiInfos, // Add lifiInfos dependency
    account.address,
    commitIntentConfigMutation,
    commitIntentConfigMutation.isPending,
    commitIntentConfigMutation.isSuccess
  ])

  // Update the sendMetaTxn mutation
  const sendMetaTxnMutation = useMutation({
    mutationFn: async ({ selectedId }: { selectedId: string | null }) => {
      if (
        !intentCallsPayloads ||
        !intentPreconditions ||
        !metaTxns ||
        !account.address ||
        !lifiInfos
      ) {
        throw new Error('Missing required data for meta-transaction')
      }

      const intentAddress = calculateIntentAddress(account.address, intentCallsPayloads, lifiInfos)

      // If no specific ID is selected, send all meta transactions
      const txnsToSend = selectedId ? [metaTxns.find(tx => tx.id === selectedId)] : metaTxns

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
          console.log(
            `Meta transaction for ${operationKey} was sent recently. Wait ${timeLeft}s before retry`
          )
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
            p => p.chainId && parseInt(p.chainId) === chainId
          )

          console.log(
            `Relaying meta transaction ${operationKey} to intent ${intentAddress} via relayer:`,
            chainRelayer
          )

          const { opHash } = await chainRelayer.sendMetaTxn(
            metaTxn.walletAddress as Address.Address,
            metaTxn.contract as Address.Address,
            metaTxn.input as Hex,
            BigInt(metaTxn.chainId),
            undefined,
            relevantPreconditions
          )

          results.push({
            operationKey,
            opHash,
            success: true
          })
        } catch (error: unknown) {
          results.push({
            operationKey,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          })
        }
      }

      return results
    },
    onSuccess: results => {
      // Update states based on results
      results.forEach(({ operationKey, opHash, success }) => {
        if (success && opHash) {
          setSentMetaTxns(prev => ({
            ...prev,
            [operationKey]: Date.now()
          }))

          setOperationHashes(prev => ({
            ...prev,
            [operationKey]: opHash
          }))
        }
      })
    },
    onError: error => {
      console.error('Error in meta-transaction process:', error)
    },
    retry: 5, // Allow up to 2 retries
    retryDelay: attemptIndex => Math.min(1000 * Math.pow(2, attemptIndex), 30000) // Exponential backoff
  })

  const [tokenAddress, setTokenAddress] = useState<string | null>(null)
  const [originChainId, setOriginChainId] = useState<number | null>(null)

  useEffect(() => {
    if (
      !intentCallsPayloads?.[0]?.chainId ||
      !tokenAddress ||
      !originChainId ||
      !intentPreconditions ||
      !account.address
    ) {
      setOriginCallParams(null)
      return
    }

    try {
      const intentAddressString = calculatedIntentAddress as Address.Address

      let calcTo: Address.Address
      let calcData: Hex = '0x'
      let calcValue: bigint = 0n

      const recipientAddress = intentAddressString

      const isNative = tokenAddress === zeroAddress

      if (isNative) {
        const nativePrecondition = intentPreconditions.find(
          (p: IntentPrecondition) =>
            (p.type === 'transfer-native' || p.type === 'native-balance') &&
            p.chainId === originChainId.toString()
        )
        const nativeMinAmount = nativePrecondition?.data?.minAmount ?? nativePrecondition?.data?.min
        if (nativeMinAmount === undefined) {
          throw new Error(
            'Could not find native precondition (transfer-native or native-balance) or min amount'
          )
        }
        calcValue = BigInt(nativeMinAmount)
        calcTo = recipientAddress
      } else {
        const erc20Precondition = intentPreconditions.find(
          (p: IntentPrecondition) =>
            p.type === 'erc20-balance' &&
            p.chainId === originChainId.toString() &&
            p.data?.token &&
            isAddressEqual(Address.from(p.data.token), Address.from(tokenAddress))
        )

        const erc20MinAmount = erc20Precondition?.data?.min
        if (erc20MinAmount === undefined) {
          throw new Error('Could not find ERC20 balance precondition or min amount')
        }
        calcData = getERC20TransferData(recipientAddress, erc20MinAmount)
        calcTo = tokenAddress as Address.Address
      }

      setOriginCallParams({
        to: calcTo,
        data: calcData,
        value: calcValue,
        chainId: originChainId,
        error: undefined
      })
    } catch (error: unknown) {
      console.error('Failed to calculate origin call params for UI:', error)
      setOriginCallParams({
        to: null,
        data: null,
        value: null,
        chainId: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [
    intentCallsPayloads,
    tokenAddress,
    originChainId,
    intentPreconditions,
    account.address,
    lifiInfos
  ])

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

  // Add monitoring for each meta transaction
  const metaTxnMonitorStatuses = useMetaTxnsMonitor(
    metaTxns as unknown as MetaTxn[] | undefined,
    operationHashes,
    getRelayer
  )

  const updateAutoExecute = (enabled: boolean) => {
    setIsAutoExecute(enabled)
  }

  function createIntent(args: GetIntentCallsPayloadsArgs) {
    createIntentMutation.mutate(args)
  }

  const calculatedIntentAddress = useMemo(() => {
    if (!account.address || !intentCallsPayloads || !lifiInfos) {
      return null
    }
    return calculateIntentAddress(account.address, intentCallsPayloads, lifiInfos)
  }, [account.address, intentCallsPayloads, lifiInfos])

  const createIntentPending = createIntentMutation.isPending
  const createIntentSuccess = createIntentMutation.isSuccess
  const createIntentError = createIntentMutation.error
  const createIntentArgs = createIntentMutation.variables

  function commitIntentConfig(args: {
    walletAddress: string
    mainSigner: string
    calls: IntentCallsPayload[]
    preconditions: IntentPrecondition[]
    lifiInfos: AnypayLifiInfo[]
  }) {
    console.log('commitIntentConfig', args)
    commitIntentConfigMutation.mutate(args)
  }

  function updateOriginCallParams(args: { originChainId: number; tokenAddress: string } | null) {
    if (!args) {
      setOriginCallParams(null)
      return
    }
    const { originChainId, tokenAddress } = args
    setOriginChainId(originChainId)
    setTokenAddress(tokenAddress)
  }

  function sendMetaTxn(selectedId: string | null) {
    sendMetaTxnMutation.mutate({ selectedId })
  }

  const commitIntentConfigPending = commitIntentConfigMutation.isPending
  const commitIntentConfigSuccess = commitIntentConfigMutation.isSuccess
  const commitIntentConfigError = commitIntentConfigMutation.error
  const commitIntentConfigArgs = commitIntentConfigMutation.variables

  const sendMetaTxnPending = sendMetaTxnMutation.isPending
  const sendMetaTxnSuccess = sendMetaTxnMutation.isSuccess
  const sendMetaTxnError = sendMetaTxnMutation.error
  const sendMetaTxnArgs = sendMetaTxnMutation.variables

  return {
    apiClient,
    metaTxns,
    intentCallsPayloads,
    intentPreconditions,
    lifiInfos,
    txnHash,
    committedIntentAddress,
    verificationStatus,
    getRelayer,
    estimatedGas,
    isEstimateError,
    estimateError,
    calculateIntentAddress,
    committedIntentConfig,
    isLoadingCommittedConfig,
    committedConfigError,
    commitIntentConfig,
    commitIntentConfigPending,
    commitIntentConfigSuccess,
    commitIntentConfigError,
    commitIntentConfigArgs,
    getIntentCallsPayloads,
    operationHashes,
    callIntentCallsPayload,
    sendOriginTransaction,
    switchChain,
    isSwitchingChain,
    switchChainError,
    isTransactionInProgress,
    isChainSwitchRequired,
    sendTransaction,
    isSendingTransaction,
    originCallStatus,
    updateOriginCallStatus,
    isEstimatingGas,
    isAutoExecute,
    updateAutoExecute,
    receipt,
    isWaitingForReceipt,
    receiptIsSuccess,
    receiptIsError,
    receiptError,
    hasAutoExecuted,
    sentMetaTxns,
    sendMetaTxn,
    sendMetaTxnPending,
    sendMetaTxnSuccess,
    sendMetaTxnError,
    sendMetaTxnArgs,
    clearIntent,
    metaTxnMonitorStatuses,
    createIntent,
    createIntentPending,
    createIntentSuccess,
    createIntentError,
    createIntentArgs,
    calculatedIntentAddress,
    originCallParams,
    updateOriginCallParams
  }
}
