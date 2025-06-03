import React from 'react'
import { Button, Text, NetworkImage } from '@0xsequence/design-system'
import { Zap } from 'lucide-react'
import { SectionHeader } from '@/components/SectionHeader'
import { getChainInfo } from '@/utils/formatting'
import { IntentCallsPayload, IntentPrecondition } from '@0xsequence/api'

interface OriginCallParamsData {
  to: string | null
  data: string | null
  value: bigint | null
  chainId: number | null
  error?: string
}

interface OriginCallStepProps {
  intentCallsPayloads: IntentCallsPayload[] | null
  intentPreconditions: IntentPrecondition[] | null
  accountAddress: string | undefined
  originCallParams: OriginCallParamsData | null
  isSendButtonDisabled: boolean
  sendButtonText: React.ReactNode
  handleSendOriginCall: () => void
}

export const OriginCallStep: React.FC<OriginCallStepProps> = ({
  intentCallsPayloads,
  intentPreconditions,
  accountAddress,
  originCallParams,
  isSendButtonDisabled,
  sendButtonText,
  handleSendOriginCall,
}) => {
  if (!intentCallsPayloads || !intentPreconditions) {
    return null
  }

  return (
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
              <span className="text-yellow-300 break-all font-mono">{accountAddress ?? '...'}</span>
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
                {originCallParams?.chainId?.toString() ?? (originCallParams?.error ? 'Error' : 'Calculating...')}
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
  )
}
