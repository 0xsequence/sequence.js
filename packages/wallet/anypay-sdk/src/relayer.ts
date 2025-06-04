import { Relayer } from '@0xsequence/wallet-core'
import { useMemo } from 'react'
import * as chains from 'viem/chains'
import { Chain } from 'viem'
import fetch from 'isomorphic-fetch'

export type RelayerOperationStatus = Relayer.OperationStatus
export type Relayer = Relayer.Rpc.RpcRelayer

// Helper to get chain info
function getChain(chainId: number): Chain {
  const chain = Object.values(chains as unknown as Record<string, Chain>).find((c: Chain) => c.id === chainId)
  if (!chain) {
    throw new Error(`Chain with id ${chainId} not found`)
  }
  return chain
}

export type RelayerConfig = {
  hostname: string
  chainId: number
  rpcUrl: string
}

export type RelayerEnvConfig = {
  env?: 'local' | 'cors-anywhere' | 'dev' | 'prod'
  useV3Relayers?: boolean
}

export function getBackupRelayer(chainId: number): Relayer.Rpc.RpcRelayer | undefined {
  if (chainId === 42161) {
    return new Relayer.Rpc.RpcRelayer('https://a1b4a8c5d856.ngrok.app/', chainId, 'https://nodes.sequence.app/arbitrum')
  } else if (chainId === 8453) {
    return new Relayer.Rpc.RpcRelayer('https://644a6aeb891e.ngrok.app/', chainId, 'https://nodes.sequence.app/base')
  }

  return undefined
}

// TODO: add relayer url to config
function getRelayerUrl(config: RelayerEnvConfig, chainId: number): string {
  let relayerUrl
  if (config.env === 'local') {
    // Use specific ports for different chains in local environment
    if (chainId === 42161) {
      // Arbitrum
      relayerUrl = 'http://0.0.0.0:9997'
    } else if (chainId === 10) {
      // Optimism
      relayerUrl = 'http://0.0.0.0:9998'
    } else if (chainId === 137) {
      // Polygon
      relayerUrl = 'http://0.0.0.0:9999'
    } else if (chainId === 8453) {
      // Base
      relayerUrl = 'http://0.0.0.0:9996'
    } else {
      // Default fallback
      relayerUrl = 'http://0.0.0.0:9999'
    }

    return relayerUrl
  }

  // For cors-anywhere, dev, and production environments
  const baseUrl =
    config.env === 'cors-anywhere'
      ? 'http://localhost:8080/https://'
      : config.env === 'dev' && config.useV3Relayers
        ? 'https://v3-'
        : config.env === 'dev'
          ? 'https://dev-relayer.sequence.app'
          : 'https://'

  // Chain-specific relayer endpoints
  if (config.env === 'dev' && config.useV3Relayers) {
    if (chainId === 42161) {
      // Arbitrum
      relayerUrl = 'https://v3-arbitrum-relayer.sequence.app'
    } else if (chainId === 8453) {
      // Base
      relayerUrl = 'https://v3-base-relayer.sequence.app'
    } else if (chainId === 10) {
      // Optimism
      relayerUrl = 'https://v3-optimism-relayer.sequence.app'
    } else if (chainId === 137) {
      // Polygon
      relayerUrl = 'https://v3-polygon-relayer.sequence.app'
    } else if (chainId === 1) {
      // Mainnet
      relayerUrl = 'https://v3-mainnet-relayer.sequence.app'
    } else {
      // Fallback to general dev relayer for other chains if V3 is specified but chain not V3-supported
      relayerUrl = `${baseUrl}${getChain(chainId).name}-relayer.sequence.app`
    }

    return relayerUrl
  }

  if (chainId === 42161) {
    // Arbitrum
    relayerUrl = `${baseUrl}arbitrum-relayer.sequence.app`
  } else if (chainId === 10) {
    // Optimism
    relayerUrl = `${baseUrl}optimism-relayer.sequence.app`
  } else if (chainId === 137) {
    // Polygon
    relayerUrl = `${baseUrl}polygon-relayer.sequence.app`
  } else if (chainId === 8453) {
    // Base
    relayerUrl = `${baseUrl}base-relayer.sequence.app`
  } else if (chainId === 43114) {
    // Avalanche
    relayerUrl = `${baseUrl}avalanche-relayer.sequence.app`
  } else if (chainId === 56) {
    // BSC
    relayerUrl = `${baseUrl}bsc-relayer.sequence.app`
  } else if (chainId === 1) {
    // Mainnet
    relayerUrl = `${baseUrl}mainnet-relayer.sequence.app`
  } else {
    // Default fallback
    relayerUrl = `${baseUrl}relayer.sequence.app`
  }

  return relayerUrl
}

export function getRelayer(config: RelayerEnvConfig, chainId: number): Relayer.Rpc.RpcRelayer {
  const chain = getChain(chainId)

  if (!chain) {
    throw new Error(`Chain with id ${chainId} not found`)
  }

  const rpcUrl = chain.rpcUrls.default.http[0]
  if (!rpcUrl) {
    throw new Error(`No RPC URL found for chain ${chainId}`)
  }

  const relayerUrl = getRelayerUrl(config, chainId)

  return new Relayer.Rpc.RpcRelayer(relayerUrl, chainId, rpcUrl, fetch)
}

export function useRelayers(config: RelayerEnvConfig): {
  relayers: Map<number, Relayer.Rpc.RpcRelayer>
  getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer
  getBackupRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer | undefined
} {
  const relayers = useMemo(() => {
    const relayerMap = new Map<number, Relayer.Rpc.RpcRelayer>()
    return relayerMap
  }, [])

  const getCachedRelayer = (chainId: number): Relayer.Rpc.RpcRelayer => {
    let relayer = relayers.get(chainId)

    if (!relayer) {
      relayer = getRelayer(config, chainId)
      relayers.set(chainId, relayer)
    }

    return relayer
  }

  return {
    relayers,
    getRelayer: getCachedRelayer,
    getBackupRelayer,
  }
}

export type { Relayer }
