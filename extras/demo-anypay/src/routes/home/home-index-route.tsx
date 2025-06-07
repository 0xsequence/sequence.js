import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Hex } from 'viem'
import { AbiFunction, Address } from 'ox'
import * as chains from 'viem/chains'
import { useAnyPay, useTokenBalances, TokenBalance, Account } from '@0xsequence/anypay-sdk'
import { Loader2 } from 'lucide-react'
import { AccountInfoSection } from '@/components/AccountInfoSection'
import { IntentAction } from '@/types'
import { SelectOriginTokenStep } from '@/components/SelectOriginTokenStep'
import { ChooseActionStep } from '@/components/ChooseActionStep'
import { IntentQuoteDisplayStep } from '@/components/IntentQuoteDisplayStep'
import { CommitIntentStep } from '@/components/CommitIntentStep'
import { OriginCallStep } from '@/components/OriginCallStep'
import { AdvancedControlsSection } from '@/components/AdvancedControlsSection'
import { RelayerStatusSection } from '@/components/RelayerStatusSection'

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
const AMOUNT = 30000n // 0.03 USDC (6 decimals)

function useHook() {
  const account = useAccount()
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null)
  const [isAutoExecuteEnabled, setIsAutoExecuteEnabled] = useState(true)
  const [showCustomCallForm, setShowCustomCallForm] = useState(false)
  const [customCallData, setCustomCallData] = useState({
    to: '',
    data: '',
    value: '0',
    chainId: BASE_USDC_DESTINATION_CHAIN_ID.toString(),
    tokenAmount: '0',
    tokenAddress: BASE_USDC_ADDRESS,
  })

  const {
    metaTxns,
    intentCallsPayloads,
    intentPreconditions,
    lifiInfos,
    committedIntentAddress,
    verificationStatus,
    committedIntentConfig,
    isLoadingCommittedConfig,
    committedConfigError,
    commitIntentConfig,
    commitIntentConfigPending,
    commitIntentConfigSuccess,
    commitIntentConfigError,
    commitIntentConfigArgs,
    createIntent,
    createIntentPending,
    createIntentSuccess,
    createIntentError,
    createIntentArgs,
    sendOriginTransaction,
    isSwitchingChain,
    isTransactionInProgress,
    isChainSwitchRequired,
    isSendingTransaction,
    originCallStatus,
    isEstimatingGas,
    isWaitingForReceipt,
    hasAutoExecuted,
    updateAutoExecute,
    sendMetaTxn,
    sendMetaTxnPending,
    sendMetaTxnSuccess,
    sendMetaTxnError,
    sendMetaTxnArgs,
    clearIntent,
    metaTxnMonitorStatuses,
    calculatedIntentAddress,
    updateOriginCallParams,
    originCallParams,
    originBlockTimestamp,
    metaTxnBlockTimestamps,
  } = useAnyPay({
    account: account as Account,
    env: import.meta.env.VITE_ENV,
  })

  const { sortedTokens, isLoadingBalances, balanceError } = useTokenBalances(account.address as Address.Address)
  const [intentActionType, setIntentActionType] = useState<IntentAction | null>(null)
  const [isManualMetaTxnEnabled, setIsManualMetaTxnEnabled] = useState(false)
  const [selectedMetaTxnId, setSelectedMetaTxnId] = useState<string | null>(null)

  function createIntentAction(action: IntentAction) {
    if (!selectedToken || !account.address) {
      throw new Error('Missing selected token or account address')
    }

    setIntentActionType(action)

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

    return args
  }

  function createIntentMutationAction(action: IntentAction) {
    const args = createIntentAction(action)
    createIntent(args)
  }

  useEffect(() => {
    if (!account.isConnected) {
      setSelectedToken(null)
      clearIntent()
    }
  }, [account.isConnected])

  useEffect(() => {
    updateAutoExecute(isAutoExecuteEnabled)
  }, [isAutoExecuteEnabled])

  const handleActionClick = (action: IntentAction) => {
    clearIntent()

    setShowCustomCallForm(false)
    if (action === 'custom_call') {
      setShowCustomCallForm(true)
    } else {
      createIntentMutationAction(action)
    }
  }

  const handleCustomCallSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createIntentMutationAction('custom_call')
    setShowCustomCallForm(false)
  }

  useEffect(() => {
    if (!selectedToken) {
      updateOriginCallParams(null)
      return
    }

    updateOriginCallParams({
      originChainId: selectedToken.chainId,
      tokenAddress: selectedToken.contractAddress,
    })
  }, [selectedToken])

  // Update button text and disabled state for commit button
  const commitButtonText = commitIntentConfigPending ? (
    <div className="flex items-center">
      <Loader2 className="animate-spin h-4 w-4 mr-2" />
      Committing...
    </div>
  ) : (
    'Commit Intent'
  )

  const isCommitButtonDisabled = Boolean(
    commitIntentConfigPending || commitIntentConfigSuccess, // Disable if commit is pending OR has already succeeded
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
    (isAutoExecuteEnabled && commitIntentConfigSuccess) // Disable if auto-execute is on and commit was successful

  // Effect to cleanup when account disconnects
  useEffect(() => {
    if (!account.isConnected) {
      clearIntent()
    }
  }, [account.isConnected])

  // Replace the sendMetaTxn function with a wrapper that uses the mutation
  const handleSendMetaTxn = (selectedId: string | null) => {
    sendMetaTxn(selectedId)
  }

  function handleSendOriginCall() {
    sendOriginTransaction()
  }

  return {
    // Account Management
    account,
    connectors,
    connect,
    disconnect,
    connectStatus,
    connectError,

    // Token Management
    selectedToken,
    setSelectedToken,
    sortedTokens,
    isLoadingBalances,
    balanceError,

    // Intent State
    intentCallsPayloads,
    intentPreconditions,
    metaTxns,
    lifiInfos,
    committedIntentAddress,
    committedIntentConfig,
    verificationStatus,
    intentActionType,

    // Transaction State
    originCallParams,
    originCallStatus,
    isTransactionInProgress,
    isSendingTransaction,
    isSwitchingChain,
    isWaitingForReceipt,
    isEstimatingGas,
    isChainSwitchRequired,
    hasAutoExecuted,

    // Auto-Execute Controls
    isAutoExecuteEnabled,
    setIsAutoExecuteEnabled,

    // Meta Transaction Management
    isManualMetaTxnEnabled,
    setIsManualMetaTxnEnabled,
    selectedMetaTxnId,
    setSelectedMetaTxnId,
    metaTxnMonitorStatuses,
    sendMetaTxnPending,
    sendMetaTxnSuccess,
    sendMetaTxnError,
    sendMetaTxnArgs,

    // Custom Call Form
    showCustomCallForm,
    setShowCustomCallForm,
    customCallData,
    setCustomCallData,

    // Action Handlers
    handleActionClick,
    handleCustomCallSubmit,
    handleSendOriginCall,
    handleSendMetaTxn,
    clearIntent,

    // Intent Mutation State
    createIntentMutationAction,
    createIntentPending,
    createIntentSuccess,
    createIntentError,
    createIntentArgs,

    // Config Mutation State
    commitIntentConfig,
    commitIntentConfigPending,
    commitIntentConfigSuccess,
    commitIntentConfigError,
    commitIntentConfigArgs,
    isLoadingCommittedConfig,
    committedConfigError,

    // UI State
    sendButtonText,
    isSendButtonDisabled,
    commitButtonText,
    isCommitButtonDisabled,

    calculatedIntentAddress,
    originBlockTimestamp,
    metaTxnBlockTimestamps,
  }
}

export const HomeIndexRoute = () => {
  const {
    // Account Management
    account,
    connectors,
    connect,
    disconnect,
    connectStatus,
    connectError,

    // Token Management
    selectedToken,
    setSelectedToken,
    sortedTokens,
    isLoadingBalances,
    balanceError,

    // Intent State
    intentCallsPayloads,
    intentPreconditions,
    metaTxns,
    lifiInfos,
    committedIntentAddress,
    committedIntentConfig,
    verificationStatus,
    intentActionType,

    // Transaction State
    originCallParams,
    originCallStatus,
    isWaitingForReceipt,

    // Auto-Execute Controls
    isAutoExecuteEnabled,
    setIsAutoExecuteEnabled,

    // Meta Transaction Management
    isManualMetaTxnEnabled,
    setIsManualMetaTxnEnabled,
    selectedMetaTxnId,
    setSelectedMetaTxnId,
    metaTxnMonitorStatuses,

    // Custom Call Form
    showCustomCallForm,
    setShowCustomCallForm,
    customCallData,
    setCustomCallData,

    // Action Handlers
    handleActionClick,
    handleCustomCallSubmit,
    handleSendOriginCall,
    handleSendMetaTxn,
    clearIntent,

    // Intent Mutation State
    createIntentPending,
    createIntentError,
    createIntentArgs,

    // Config Mutation State
    commitIntentConfig,
    commitIntentConfigSuccess,
    commitIntentConfigError,
    isLoadingCommittedConfig,
    committedConfigError,
    // commitIntentConfigPending,
    // commitIntentConfigArgs,

    // UI State
    sendButtonText,
    isSendButtonDisabled,
    commitButtonText,
    isCommitButtonDisabled,

    calculatedIntentAddress,
    sendMetaTxnPending,
    originBlockTimestamp,
    metaTxnBlockTimestamps,
  } = useHook()

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto min-h-screen">
      <div className="text-center mb-8 animate-fadeIn">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
          Sequence Anypay Demo
        </h1>
        <p className="text-gray-300 text-sm">Connect your wallet and explore cross-chain intents</p>
      </div>

      {/* Account Info & Connect/Disconnect - Standalone Card */}
      <AccountInfoSection
        account={account}
        connectors={connectors}
        connect={connect}
        disconnect={disconnect}
        connectStatus={connectStatus}
        connectError={connectError}
      />

      {/* Main Workflow Card - Container for Steps 2-6 */}
      {account.status === 'connected' && (
        <div className="bg-gray-800/80 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm space-y-6 transition-all duration-300 hover:shadow-blue-900/20 mb-6">
          {/* Step 2: Select Origin Token */}
          <SelectOriginTokenStep
            isLoadingBalances={isLoadingBalances}
            balanceError={balanceError}
            sortedTokens={sortedTokens}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            clearIntent={clearIntent}
          />

          {/* Step 3: Choose Action */}
          <ChooseActionStep
            isAutoExecuteEnabled={isAutoExecuteEnabled}
            setIsAutoExecuteEnabled={setIsAutoExecuteEnabled}
            handleActionClick={handleActionClick}
            selectedToken={selectedToken}
            createIntentPending={createIntentPending}
            intentActionType={intentActionType}
            createIntentArgs={createIntentArgs}
            showCustomCallForm={showCustomCallForm}
            setShowCustomCallForm={setShowCustomCallForm}
            customCallData={customCallData}
            setCustomCallData={setCustomCallData}
            handleCustomCallSubmit={handleCustomCallSubmit}
          />

          {/* Step 4: Intent Quote Display */}
          <IntentQuoteDisplayStep
            createIntentPending={createIntentPending}
            createIntentError={createIntentError}
            intentCallsPayloads={intentCallsPayloads}
            intentPreconditions={intentPreconditions}
            metaTxns={metaTxns}
            lifiInfos={lifiInfos}
            intentActionType={intentActionType}
            selectedToken={selectedToken}
            account={account as any}
            calculatedIntentAddress={calculatedIntentAddress}
            customCallData={customCallData}
          />

          {/* Step 5: Commit Intent */}
          <CommitIntentStep
            intentCallsPayloads={intentCallsPayloads}
            intentPreconditions={intentPreconditions}
            lifiInfos={lifiInfos}
            verificationStatus={verificationStatus}
            commitIntentConfigError={commitIntentConfigError}
            commitIntentConfigSuccess={commitIntentConfigSuccess}
            committedIntentAddress={committedIntentAddress}
            isLoadingCommittedConfig={isLoadingCommittedConfig}
            committedConfigError={committedConfigError}
            committedIntentConfigData={committedIntentConfig}
            commitIntentConfig={commitIntentConfig}
            isCommitButtonDisabled={isCommitButtonDisabled}
            commitButtonText={commitButtonText}
            calculatedIntentAddress={calculatedIntentAddress}
            accountAddress={account?.address}
          />

          {/* Step 6: Origin Call - Replace with Component */}
          <OriginCallStep
            intentCallsPayloads={intentCallsPayloads}
            intentPreconditions={intentPreconditions}
            accountAddress={account?.address}
            originCallParams={originCallParams}
            isSendButtonDisabled={isSendButtonDisabled}
            sendButtonText={sendButtonText}
            handleSendOriginCall={handleSendOriginCall}
          />

          {/* Replace Preview Calculated Address and Manual Meta Txn Controls with Component */}
          <AdvancedControlsSection
            accountAddress={account?.address}
            intentCallsPayloads={intentCallsPayloads}
            originCallParams={originCallParams}
            metaTxns={metaTxns}
            intentActionType={intentActionType}
            customCallData={customCallData}
            isManualMetaTxnEnabled={isManualMetaTxnEnabled}
            setIsManualMetaTxnEnabled={setIsManualMetaTxnEnabled}
            selectedMetaTxnId={selectedMetaTxnId}
            setSelectedMetaTxnId={setSelectedMetaTxnId}
            handleSendMetaTxn={handleSendMetaTxn}
            sendMetaTxnPending={sendMetaTxnPending}
          />
        </div>
      )}

      {account.status === 'connected' && (
        <RelayerStatusSection
          originCallStatus={originCallStatus}
          isWaitingForReceipt={isWaitingForReceipt}
          metaTxns={metaTxns}
          metaTxnMonitorStatuses={metaTxnMonitorStatuses}
          originBlockTimestamp={originBlockTimestamp}
          metaTxnBlockTimestamps={metaTxnBlockTimestamps}
          originCallParams={originCallParams}
        />
      )}
    </div>
  )
}
