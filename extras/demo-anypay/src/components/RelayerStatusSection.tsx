import { Text, NetworkImage } from '@0xsequence/design-system'
import { Box, Layers } from 'lucide-react'
import { SectionHeader } from '@/components/SectionHeader'
import { MetaTxn, MetaTxnStatus, OriginCallParams } from '@0xsequence/anypay-sdk'
import { getChainInfo, getExplorerUrlForTransaction, formatTimeSinceOrigin } from '@/utils/formatting'

interface OriginCallStatusData {
  txnHash?: string
  status?: string
  revertReason?: string | null
  gasUsed?: number
  effectiveGasPrice?: string
}

interface RelayerStatusSectionProps {
  originCallStatus: OriginCallStatusData | null
  isWaitingForReceipt: boolean
  metaTxns: MetaTxn[] | null
  metaTxnMonitorStatuses: MetaTxnStatus
  originBlockTimestamp: number | null
  metaTxnBlockTimestamps: {
    [key: string]: { timestamp: number | null; error?: string }
  }
  originCallParams: OriginCallParams | null
}

export const RelayerStatusSection = ({
  originCallStatus,
  isWaitingForReceipt,
  metaTxns,
  metaTxnMonitorStatuses,
  originBlockTimestamp,
  metaTxnBlockTimestamps,
  originCallParams,
}: RelayerStatusSectionProps) => {
  return (
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
        {/* Origin Call Status */}
        <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto shadow-inner">
          <Text variant="medium" color="primary" className="mb-4 pb-2 border-b border-gray-700/50 flex items-center">
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
                {originCallStatus?.txnHash && originCallParams?.chainId && (
                  <div className="mt-1">
                    <a
                      href={getExplorerUrlForTransaction(originCallParams.chainId, originCallStatus.txnHash) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`View transaction ${originCallStatus.txnHash} on ${
                        getChainInfo(originCallParams.chainId)?.name || 'explorer'
                      }`}
                      className="text-gray-300 flex items-center space-x-1 hover:underline text-xs break-all"
                    >
                      <NetworkImage chainId={originCallParams.chainId} size="xs" className="w-3 h-3" />
                      <span>{getExplorerUrlForTransaction(originCallParams.chainId, originCallStatus.txnHash)}</span>
                    </a>
                  </div>
                )}
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
            {typeof originBlockTimestamp === 'number' && Number.isFinite(originBlockTimestamp) && (
              <div className="bg-gray-800/70 p-3 rounded-md">
                <Text variant="small" color="secondary">
                  <strong className="text-blue-300">Block Timestamp: </strong>
                  <span className="font-mono">
                    {new Date(originBlockTimestamp * 1000).toLocaleString()} (Epoch: {originBlockTimestamp})
                  </span>
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* Meta Transactions Status */}
        <div className="bg-gray-900/90 p-4 rounded-lg border border-gray-700/70 overflow-x-auto shadow-inner">
          <Text variant="medium" color="primary" className="mb-4 pb-2 border-b border-gray-700/50 flex items-center">
            <Box className="h-4 w-4 mr-2" />
            Meta Transactions Status
          </Text>
          <div className="space-y-4">
            {metaTxns?.map((metaTxn: MetaTxn, index: number) => {
              const operationKey = `${metaTxn.chainId}-${metaTxn.id}`
              const monitorStatus = metaTxnMonitorStatuses[operationKey]

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
                      <NetworkImage chainId={parseInt(metaTxn.chainId)} size="sm" className="w-4 h-4 mr-2" />
                      Meta Transaction #{index + 1} - Chain {metaTxn.chainId}
                      <span className="text-gray-400 text-xs ml-2">
                        ({getChainInfo(parseInt(metaTxn.chainId))?.name || 'Unknown Chain'})
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
                        <span className="font-mono text-yellow-300 break-all">{metaTxn.id || 'N/A'}</span>
                      </Text>
                    </div>
                    {monitorStatus?.status === 'confirmed' && monitorStatus.transactionHash && (
                      <div>
                        <Text variant="small" color="secondary">
                          <strong className="text-blue-300">Tx Hash: </strong>
                          <span className="font-mono text-yellow-300 break-all">
                            {String(monitorStatus.transactionHash)}
                          </span>
                        </Text>
                      </div>
                    )}
                    {metaTxnBlockTimestamps && metaTxnBlockTimestamps[operationKey]?.timestamp && (
                      <div>
                        <Text variant="small" color="secondary">
                          <strong className="text-blue-300">Block Timestamp: </strong>
                          <span className="font-mono">
                            {new Date((metaTxnBlockTimestamps[operationKey]?.timestamp || 0) * 1000).toLocaleString()}
                          </span>
                          <br />
                          <span className="font-mono text-purple-300">
                            (Executed:{' '}
                            {formatTimeSinceOrigin(
                              metaTxnBlockTimestamps[operationKey]?.timestamp || null,
                              originBlockTimestamp,
                            )}
                            )
                          </span>
                        </Text>
                      </div>
                    )}
                    {monitorStatus?.status === 'confirmed' && monitorStatus && monitorStatus.transactionHash && (
                      <div className="bg-gray-800/70 p-2 rounded-md">
                        <a
                          href={
                            getExplorerUrlForTransaction(parseInt(metaTxn.chainId), monitorStatus.transactionHash) ||
                            '#'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`View transaction ${monitorStatus.transactionHash} on ${
                            getChainInfo(parseInt(metaTxn.chainId))?.name || 'explorer'
                          }`}
                          className="text-gray-300 flex items-center space-x-1 hover:underline text-xs break-all"
                        >
                          <NetworkImage chainId={parseInt(metaTxn.chainId)} size="xs" className="w-3 h-3" />
                          <span>
                            {getExplorerUrlForTransaction(parseInt(metaTxn.chainId), monitorStatus.transactionHash)}
                          </span>
                        </a>
                      </div>
                    )}
                    {monitorStatus?.status === 'failed' && monitorStatus && 'reason' in monitorStatus && (
                      <Text variant="small" color="negative">
                        <strong className="text-red-300">Error: </strong>
                        <span className="font-mono break-all">{String((monitorStatus as any).reason)}</span>
                      </Text>
                    )}
                    {/* {monitorStatus?.status === 'confirmed' && monitorStatus.data && typeof monitorStatus.data.receipt.!== 'undefined' && (
                        <Text variant="small" color="secondary">
                            <strong className="text-blue-300">Gas Used: </strong>
                            <span className="font-mono">{String(monitorStatus.data.gasUsed)}</span>
                        </Text>
                    )} */}
                    {(monitorStatus?.status === 'confirmed' || monitorStatus?.status === 'failed') && monitorStatus && (
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
  )
}
