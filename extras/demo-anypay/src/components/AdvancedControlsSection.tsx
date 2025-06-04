import React from 'react'
import { Button, Text, NetworkImage } from '@0xsequence/design-system'
import { Layers, Info, Loader2 } from 'lucide-react'
import { getChainInfo, getExplorerUrl } from '@/utils/formatting'
import { IntentAction } from '@/types'
import { IntentCallsPayload } from '@0xsequence/api'
import { MetaTxn } from '@0xsequence/anypay-sdk'
import * as chains from 'viem/chains'

const BASE_USDC_DESTINATION_CHAIN_ID = chains.base.id
const RECIPIENT_ADDRESS = '0x750EF1D7a0b4Ab1c97B7A623D7917CcEb5ea779C'
const MOCK_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_CHAIN_ID = chains.arbitrum.id

interface OriginCallParamsData {
  to: string | null
}

interface CustomCallDataForExplorer {
  to: string
  chainId: string
}

interface AdvancedControlsSectionProps {
  accountAddress: string | undefined
  intentCallsPayloads: IntentCallsPayload[] | null
  originCallParams: OriginCallParamsData | null
  metaTxns: MetaTxn[] | null
  intentActionType: IntentAction | null
  customCallData: CustomCallDataForExplorer
  isManualMetaTxnEnabled: boolean
  setIsManualMetaTxnEnabled: (enabled: boolean) => void
  selectedMetaTxnId: string | null
  setSelectedMetaTxnId: (id: string | null) => void
  handleSendMetaTxn: (selectedId: string | null) => void
  sendMetaTxnPending: boolean
}

export const AdvancedControlsSection: React.FC<AdvancedControlsSectionProps> = ({
  accountAddress,
  intentCallsPayloads,
  originCallParams,
  metaTxns,
  intentActionType,
  customCallData,
  isManualMetaTxnEnabled,
  setIsManualMetaTxnEnabled,
  selectedMetaTxnId,
  setSelectedMetaTxnId,
  handleSendMetaTxn,
  sendMetaTxnPending,
}) => {
  if (!accountAddress || !intentCallsPayloads) {
    return null
  }

  return (
    <div className="px-6 space-y-6 pb-6">
      {/* Preview calculated address */}
      <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 shadow-inner space-y-3">
        <Text variant="small" color="secondary">
          <strong className="text-blue-300">Calculated Intent Address (used as recipient for origin call): </strong>
          <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
            {originCallParams?.to?.toString() || 'N/A'}
          </span>
        </Text>
        {originCallParams?.to && metaTxns && metaTxns.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2">
            <Text variant="small" color="secondary" className="mb-1 text-blue-300 font-semibold">
              Open in explorer (Calculated Intent Address):
            </Text>
            <div className="flex flex-col space-y-1">
              {[...new Set(metaTxns.map((tx: MetaTxn) => tx.chainId))]
                .map((chainIdStr: string | bigint) => parseInt(chainIdStr.toString())) // Ensure string before parseInt
                .map((chainId: number) => {
                  const explorerUrl = getExplorerUrl(chainId, originCallParams.to!)
                  const chainInfo = getChainInfo(chainId)
                  if (!explorerUrl) return null
                  return (
                    <div key={`${chainId}-explorer-link`} className="bg-gray-800/70 p-2 rounded-md">
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${originCallParams.to} on ${chainInfo?.name || 'explorer'}`}
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
        {intentCallsPayloads && intentActionType && (
          <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2">
            <Text variant="small" color="secondary" className="mb-1 text-blue-300 font-semibold">
              Open in Explorer: (Final Destination Address)
            </Text>
            <div className="flex flex-col space-y-1">
              {(() => {
                const currentAction = intentActionType
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
            <div className="bg-gray-800/70 p-3 rounded-md">
              <Text variant="small" color="secondary" className="mb-2">
                Select Meta Transaction:
              </Text>
              <div className="space-y-2">
                {metaTxns?.map((tx: MetaTxn, index: number) => (
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
                        <NetworkImage chainId={parseInt(tx.chainId.toString())} size="sm" className="w-4 h-4" />
                        <Text variant="small" color="secondary">
                          #{index + 1} - Chain {tx.chainId.toString()}
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

            <div className="flex gap-2">
              <Button
                variant="feature"
                onClick={() => handleSendMetaTxn(selectedMetaTxnId)}
                disabled={!metaTxns || metaTxns.length === 0 || !accountAddress || sendMetaTxnPending}
                className="flex-1 px-4 py-2 shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center bg-purple-600 hover:bg-purple-700"
              >
                {sendMetaTxnPending ? (
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
  )
}
