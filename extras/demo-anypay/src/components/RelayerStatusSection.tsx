import { Text, NetworkImage } from '@0xsequence/design-system'
import { Box, Layers } from 'lucide-react'
import { SectionHeader } from '@/components/SectionHeader'
import { MetaTxn, RelayerOperationStatus } from '@anypay/sdk'
import * as chains from 'viem/chains'

// Helper to get chain info
const getChainInfo = (chainId: number) => {
  return Object.values(chains).find((chain) => chain.id === chainId) || null
}

const getExplorerUrl = (chainId: number, addressOrTxHash: string): string | null => {
  const chainInfo = getChainInfo(chainId)
  if (chainInfo && chainInfo.blockExplorers?.default?.url) {
    if (addressOrTxHash.length === 42) {
      // Likely an address
      return `${chainInfo.blockExplorers.default.url}/address/${addressOrTxHash}`
    } else if (addressOrTxHash.length === 66) {
      // Likely a transaction hash
      return `${chainInfo.blockExplorers.default.url}/tx/${addressOrTxHash}`
    }
  }
  return null
}

interface RelayerStatusSectionProps {
  accountStatus: string
  originCallStatus?: {
    txnHash?: string
    status?: string
    revertReason?: string | null
    gasUsed?: string | number
    effectiveGasPrice?: string | number
  } | null
  isWaitingForReceipt: boolean
  metaTxns?: MetaTxn[] | null
  metaTxnMonitorStatuses: Record<string, RelayerOperationStatus>
}

// Type guard for operation status with gas used
type OperationStatusWithGas = {
  status: 'confirmed'
  gasUsed: bigint
  txHash: string
  transactionHash: `0x${string}`
}

const hasGasUsed = (status: RelayerOperationStatus | undefined): status is OperationStatusWithGas => {
  return !!status && status.status === 'confirmed' && 'gasUsed' in status && typeof status.gasUsed === 'bigint'
}

export const RelayerStatusSection = ({
  accountStatus,
  originCallStatus,
  isWaitingForReceipt,
  metaTxns,
  metaTxnMonitorStatuses,
}: RelayerStatusSectionProps) => {
  if (accountStatus !== 'connected') {
    return null
  }

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
                <span className="font-mono">{originCallStatus?.gasUsed?.toString() || '0'}</span>
              </Text>
            </div>
            <div className="bg-gray-800/70 p-3 rounded-md">
              <Text variant="small" color="secondary">
                <strong className="text-blue-300">Effective Gas Price: </strong>
                <span className="font-mono">{originCallStatus?.effectiveGasPrice?.toString() || '0'}</span>
              </Text>
            </div>
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
                    {monitorStatus?.status === 'confirmed' && monitorStatus && 'txHash' in monitorStatus && (
                      <Text variant="small" color="secondary">
                        <strong className="text-blue-300">Tx Hash: </strong>
                        <span className="font-mono text-yellow-300 break-all">{String(monitorStatus.txHash)}</span>
                      </Text>
                    )}
                    {monitorStatus?.status === 'confirmed' &&
                      monitorStatus &&
                      'txHash' in monitorStatus &&
                      typeof monitorStatus.txHash === 'string' &&
                      monitorStatus.txHash && (
                        <Text variant="small" color="secondary">
                          <strong className="text-blue-300">Explorer: </strong>
                          <a
                            href={getExplorerUrl(parseInt(metaTxn.chainId), monitorStatus.txHash) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-purple-400 hover:underline break-all"
                          >
                            {getExplorerUrl(parseInt(metaTxn.chainId), monitorStatus.txHash)}
                          </a>
                        </Text>
                      )}
                    {monitorStatus?.status === 'failed' && monitorStatus && 'reason' in monitorStatus && (
                      <Text variant="small" color="negative">
                        <strong className="text-red-300">Error: </strong>
                        <span className="font-mono break-all">{String(monitorStatus.reason)}</span>
                      </Text>
                    )}
                    {hasGasUsed(monitorStatus) && (
                      <Text variant="small" color="secondary">
                        <strong className="text-blue-300">Gas Used: </strong>
                        <span className="font-mono">{monitorStatus.gasUsed.toString()}</span>
                      </Text>
                    )}
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
