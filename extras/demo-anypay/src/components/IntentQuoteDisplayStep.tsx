import React from 'react'
import { Text, NetworkImage } from '@0xsequence/design-system'
import { Account, TokenBalance, MetaTxn } from '@0xsequence/anypay-sdk'
import { IntentPrecondition, AnypayLifiInfo, IntentCallsPayload } from '@0xsequence/api'
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  Zap,
  Info,
  Clipboard,
  Layers,
  Box,
  PenSquare,
  ShieldCheck,
} from 'lucide-react'
import { SectionHeader } from '@/components/SectionHeader'
import { getChainInfo } from '@/utils/formatting'
import { IntentAction } from '@/types'
import { Hex, formatUnits, isAddressEqual, zeroAddress } from 'viem'
import { Address as OxAddress } from 'ox'
import * as chains from 'viem/chains'

// Mock Data
const BASE_USDC_DESTINATION_CHAIN_ID = chains.base.id
const RECIPIENT_ADDRESS = '0x750EF1D7a0b4Ab1c97B7A623D7917CcEb5ea779C'
const AMOUNT = 300000n
const MOCK_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_CHAIN_ID = chains.arbitrum.id
const MOCK_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_TOKEN_AMOUNT = '3000000'

interface IntentQuoteDisplayStepProps {
  createIntentPending: boolean
  createIntentError: Error | null
  intentCallsPayloads: IntentCallsPayload[] | null
  intentPreconditions: IntentPrecondition[] | null
  metaTxns: MetaTxn[] | null
  lifiInfos: AnypayLifiInfo[] | null
  intentActionType: IntentAction | null
  selectedToken: TokenBalance | null
  account: Account | undefined
  calculatedIntentAddress: string | null
  customCallData: {
    to: string
    value: string
    chainId: string
    data: string
  }
}

export const IntentQuoteDisplayStep: React.FC<IntentQuoteDisplayStepProps> = ({
  createIntentPending,
  createIntentError,
  intentCallsPayloads,
  intentPreconditions,
  metaTxns,
  lifiInfos,
  intentActionType,
  selectedToken,
  account,
  calculatedIntentAddress,
  customCallData,
}) => {
  if (createIntentPending) {
    return (
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
    )
  }

  if (createIntentError) {
    return (
      <div className="px-6 pb-6">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
          <Text variant="small" color="negative" className="break-words flex items-center text-center">
            <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
            <span>Error: {createIntentError.message}</span>
          </Text>
        </div>
      </div>
    )
  }

  if (!intentCallsPayloads) {
    return (
      <div className="px-6 pb-6">
        <div className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-4 flex items-center justify-center">
          <Text variant="small" color="secondary" className="flex flex-col items-center text-center">
            <ShieldCheck className="h-10 w-10 text-gray-600 mb-2" />
            Select a token and click an action above to generate the intent quote.
          </Text>
        </div>
      </div>
    )
  }

  const primarySubtitleNode = (() => {
    if (!intentCallsPayloads || !intentActionType || !selectedToken) return null

    if (intentActionType === 'pay') {
      const baseChainInfo = getChainInfo(BASE_USDC_DESTINATION_CHAIN_ID)
      const baseChainName = baseChainInfo?.name || `Chain ID ${BASE_USDC_DESTINATION_CHAIN_ID}`
      return (
        <>
          <Zap className="h-3.5 w-3.5 mr-1.5 text-purple-400 flex-shrink-0" />
          Intent: Send <strong className="text-gray-200 mx-1">{formatUnits(AMOUNT, 6)} USDC</strong>
          to{' '}
          <strong className="text-gray-200 font-mono mx-1 truncate max-w-[100px]" title={RECIPIENT_ADDRESS}>
            {RECIPIENT_ADDRESS}
          </strong>
          on <strong className="text-gray-200 mx-1">{baseChainName}</strong>
        </>
      )
    } else if (intentActionType === 'mock_interaction') {
      const mockChainInfo = getChainInfo(MOCK_CHAIN_ID)
      const mockChainName = mockChainInfo?.name || `Chain ID ${MOCK_CHAIN_ID}`
      return (
        <>
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-yellow-400 flex-shrink-0" />
          Intent: Target{' '}
          <strong className="text-gray-200 font-mono mx-1 truncate max-w-[70px]" title={MOCK_CONTRACT_ADDRESS}>
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
    } else if (intentActionType === 'custom_call') {
      const destChainId = parseInt(customCallData.chainId)
      const destChainInfo = getChainInfo(destChainId)
      const destChainName = destChainInfo?.name || `Chain ID ${destChainId}`
      const formattedVal = formatUnits(
        BigInt(customCallData.value || '0'),
        destChainInfo?.nativeCurrency.decimals || 18,
      )
      const nativeSymbol = destChainInfo?.nativeCurrency.symbol || 'ETH'

      return (
        <>
          <PenSquare className="h-3.5 w-3.5 mr-1.5 text-green-400 flex-shrink-0" />
          Intent: Call{' '}
          <strong className="text-gray-200 font-mono mx-1 truncate max-w-[70px]" title={customCallData.to}>
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
    return null
  })()

  const routeSubtitleNode = (() => {
    if (
      !intentCallsPayloads ||
      !intentActionType ||
      !selectedToken ||
      !account?.address ||
      !lifiInfos ||
      !intentPreconditions
    )
      return null

    try {
      const tokenName = selectedToken.contractInfo?.symbol || selectedToken.contractInfo?.name || 'Token'
      const selectedTokenChainIdStr = selectedToken.chainId.toString()
      const originChainInfo = getChainInfo(selectedToken.chainId)
      const originChainName = originChainInfo?.name || `Chain ID ${selectedToken.chainId}`
      let amountToSendFormatted = '[Amount Error]'

      const isNativeEquivalent = selectedToken.contractAddress === zeroAddress
      let amountBigInt: bigint | undefined = undefined
      let decimals: number | undefined = undefined

      if (isNativeEquivalent) {
        const nativePrecondition = intentPreconditions.find(
          (p: IntentPrecondition) =>
            (p.type === 'transfer-native' || p.type === 'native-balance') && p.chainId === selectedTokenChainIdStr,
        )
        const nativeMinAmount = nativePrecondition?.data?.minAmount ?? nativePrecondition?.data?.min
        if (nativeMinAmount !== undefined) {
          amountBigInt = BigInt(nativeMinAmount)
          decimals = selectedToken.contractInfo?.decimals || 18
        }
      } else {
        const erc20Precondition = intentPreconditions.find(
          (p: IntentPrecondition) =>
            p.type === 'erc20-balance' &&
            p.chainId === selectedTokenChainIdStr &&
            p.data?.token &&
            isAddressEqual(OxAddress.from(p.data.token), OxAddress.from(selectedToken.contractAddress as Hex)),
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

      return (
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
              title={calculatedIntentAddress || 'N/A'}
            >
              {calculatedIntentAddress || 'N/A'}
            </strong>
          </span>
        </>
      )
    } catch (routeError) {
      console.error('Error processing route subtitle data:', routeError)
      return (
        <span className="flex items-center text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
          Error generating route summary.
        </span>
      )
    }
  })()

  return (
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
      actionSubtitle={primarySubtitleNode}
      subtitle={routeSubtitleNode}
    >
      <div className="text-xs text-gray-300 bg-gray-900/90 p-4 mt-2 rounded-lg border-t border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
        <Text variant="medium" color="primary" className="mb-2 pb-1 border-b border-gray-700/50 flex items-center">
          <Zap className="h-4 w-4 mr-1" />
          Intent all payloads
          <Text variant="small" color="secondary" className="ml-1">
            (List of all payloads that are pre-authorized to be executed):
          </Text>
        </Text>

        {intentCallsPayloads && intentCallsPayloads.length > 0 ? (
          <div className="space-y-2">
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
              <div key={`operation-${index}`} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
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
                            {operation.chainId.toString()}
                          </span>
                        </Text>
                        <NetworkImage
                          chainId={parseInt(operation.chainId.toString())}
                          size="sm"
                          className="w-4 h-4 ml-1"
                        />
                        <Text variant="small" color="secondary" className="ml-1">
                          {getChainInfo(parseInt(operation.chainId.toString()))?.name || 'Unknown Chain'}
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

        {metaTxns && metaTxns.length > 0 && (
          <div className="mt-4">
            <Text variant="medium" color="primary" className="mb-2 pb-1 border-b border-gray-700/50 flex items-center">
              <Layers className="h-4 w-4 mr-1" />
              Meta-transactions
              <Text variant="small" color="secondary" className="ml-1">
                (Transactions that will be relayed):
              </Text>
            </Text>
            <div className="space-y-2">
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
                <div key={`metatx-${index}`} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
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
                        <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded-full">
                          {tx.chainId.toString()}
                        </span>
                        <NetworkImage
                          chainId={parseInt(tx.chainId.toString())}
                          size="sm"
                          className="w-4 h-4 ml-1 inline-block"
                        />
                        <span className="ml-1">
                          {getChainInfo(parseInt(tx.chainId.toString()))?.name || 'Unknown Chain'}
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

        {lifiInfos && lifiInfos.length > 0 && (
          <div className="mt-4">
            <Text variant="medium" color="primary" className="mb-2 pb-1 border-b border-gray-700/50 flex items-center">
              <Info className="h-4 w-4 mr-1" />
              Lifi Infos
              <Text variant="small" color="secondary" className="ml-1">
                (Details from Lifi integration):
              </Text>
            </Text>
            <div className="space-y-2">
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
              {intentPreconditions.map((cond, index) => (
                <li key={index} className="break-all bg-gray-800/70 p-2 rounded-md border-l-2 border-purple-500">
                  <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(cond, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)}
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
  )
}
