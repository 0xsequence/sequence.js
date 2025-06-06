import {
  ContractVerificationStatus,
  NativeTokenBalance,
  TokenBalance,
  GatewayNativeTokenBalances,
  GatewayTokenBalance,
  GetTokenBalancesSummaryReturn,
  SequenceIndexerGateway,
} from '@0xsequence/indexer'
import { useMemo } from 'react'
import { useConfig } from '@0xsequence/hooks'

export type IndexerGatewayConfig = {
  indexerGatewayUrl?: string
  projectAccessKey?: string
  jwt?: string
}

export function getIndexerGatewayClient(config: IndexerGatewayConfig): SequenceIndexerGateway {
  return new SequenceIndexerGateway(config.indexerGatewayUrl as string, config.projectAccessKey, config.jwt)
}

export const useIndexerGatewayClient = (config?: IndexerGatewayConfig) => {
  const { projectAccessKey, jwt, env } = useConfig()

  const indexerGatewayClient = useMemo(() => {
    return getIndexerGatewayClient({
      indexerGatewayUrl: config?.indexerGatewayUrl ?? env.indexerGatewayUrl,
      projectAccessKey: config?.projectAccessKey ?? projectAccessKey,
      jwt: config?.jwt ?? jwt,
    })
  }, [projectAccessKey, jwt, env.indexerGatewayUrl, config])

  return indexerGatewayClient
}
