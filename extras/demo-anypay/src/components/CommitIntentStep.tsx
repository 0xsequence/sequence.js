import React from 'react'
import { Button, Text } from '@0xsequence/design-system'
import { IntentCallsPayload, IntentPrecondition, AnypayLifiInfo, GetIntentConfigReturn } from '@0xsequence/api'
import { Loader2, AlertCircle, Zap } from 'lucide-react'
import { SectionHeader } from '@/components/SectionHeader'

interface CommitIntentStepProps {
  intentCallsPayloads: IntentCallsPayload[] | null
  intentPreconditions: IntentPrecondition[] | null
  lifiInfos: AnypayLifiInfo[] | null
  verificationStatus: {
    success: boolean
    receivedAddress?: string
    calculatedAddress?: string
  } | null
  commitIntentConfigError: Error | null
  commitIntentConfigSuccess: boolean
  committedIntentAddress: string | null
  isLoadingCommittedConfig: boolean
  committedConfigError: Error | null
  committedIntentConfigData: GetIntentConfigReturn | undefined
  commitIntentConfig: (args: {
    walletAddress: string | null
    mainSigner: string
    calls: IntentCallsPayload[]
    preconditions: IntentPrecondition[]
    lifiInfos: AnypayLifiInfo[]
  }) => void
  isCommitButtonDisabled: boolean
  commitButtonText: React.ReactNode
  calculatedIntentAddress: string | null
  accountAddress: string | undefined
}

export const CommitIntentStep: React.FC<CommitIntentStepProps> = ({
  intentCallsPayloads,
  intentPreconditions,
  lifiInfos,
  verificationStatus,
  commitIntentConfigError,
  commitIntentConfigSuccess,
  committedIntentAddress,
  isLoadingCommittedConfig,
  committedConfigError,
  committedIntentConfigData,
  commitIntentConfig,
  isCommitButtonDisabled,
  commitButtonText,
  calculatedIntentAddress,
  accountAddress,
}) => {
  if (!intentCallsPayloads || !intentPreconditions) {
    return null
  }

  return (
    <>
      <SectionHeader
        noFrame={true}
        titleContainerClassName="px-6 pt-4 pb-4 flex items-center justify-between w-full hover:bg-gray-700/60 rounded-md"
        contentContainerClassName="px-6 pb-4 border-t border-gray-700/30"
        isCollapsible={true}
        defaultOpen={false} // Default to closed as it's a detailed step
        title={
          <div className="flex items-center">
            <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-2 shadow-lg">
              <span>5</span>
            </div>
            <h3 className="text-xl font-semibold text-white">Commit Intent</h3>
          </div>
        }
      >
        <div className="text-xs text-gray-300 bg-gray-900/90 p-4 mt-2 rounded-lg border-t border-gray-700/70 overflow-x-auto space-y-2 shadow-inner animate-fadeIn">
          <div className="flex flex-col space-y-4">
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
                      {verificationStatus.success ? 'Address Verification Successful' : 'Address Verification Failed'}
                    </Text>
                    <div className="mt-2 text-xs text-gray-400 flex flex-col space-y-1 w-full">
                      <div>
                        Calculated:
                        <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
                          {verificationStatus.calculatedAddress || 'N/A'}
                        </span>
                      </div>
                      <div>
                        Expected (from precondition):
                        <span className="font-mono text-xs break-all bg-gray-800/70 p-1 rounded block mt-1">
                          {verificationStatus.receivedAddress || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {commitIntentConfigError && (
              <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 mt-2">
                <Text variant="small" color="negative">
                  Commit Error: {commitIntentConfigError.message}
                </Text>
              </div>
            )}
            {commitIntentConfigSuccess && (
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 mt-2">
                <Text variant="small" color="white">
                  Intent configuration committed successfully!
                </Text>
              </div>
            )}

            {committedIntentAddress && commitIntentConfigSuccess && (
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
                {committedIntentConfigData && !isLoadingCommittedConfig && !committedConfigError && (
                  <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap bg-gray-800/70 p-3 text-gray-300 rounded-md max-h-60 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    {JSON.stringify(committedIntentConfigData, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionHeader>
      <div className="px-6 pt-4">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/30">
          <div className="flex items-center justify-between">
            <Text variant="medium" color="primary" className="mb-2 pb-1 border-b border-gray-700/50 flex items-center">
              <Zap className="h-4 w-4 mr-1" />
              Commit Intent Action
              <Text variant="small" color="secondary" className="ml-1">
                (Verify and Send Transaction)
              </Text>
            </Text>
            <Button
              variant="primary"
              onClick={() => {
                if (!accountAddress || !intentCallsPayloads || !intentPreconditions || !lifiInfos) return
                commitIntentConfig({
                  walletAddress: calculatedIntentAddress,
                  mainSigner: accountAddress,
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
  )
}
