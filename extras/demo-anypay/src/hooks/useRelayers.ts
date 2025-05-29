import { Relayer } from '@0xsequence/wallet-core'
import { useMemo } from 'react'
import * as chains from 'viem/chains'
import { Chain } from 'viem'

// Helper to get chain info
const getChain = (chainId: number): Chain => {
  const chain = Object.values(chains).find((c: any) => c.id === chainId)
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

export const useRelayers = () => {
  const relayers = useMemo(() => {
    const relayerMap = new Map<number, Relayer.Rpc.RpcRelayer>()
    return relayerMap
  }, [])

  const getBackupRelayer = (chainId: number): Relayer.Rpc.RpcRelayer | undefined => {
    if (chainId === 42161) {
      return new Relayer.Rpc.RpcRelayer(
        'https://a1b4a8c5d856.ngrok.app/',
        chainId,
        'https://nodes.sequence.app/arbitrum',
      )
    } else if (chainId === 8453) {
      return new Relayer.Rpc.RpcRelayer('https://644a6aeb891e.ngrok.app/', chainId, 'https://nodes.sequence.app/base')
    }

    return undefined
  }

  const getRelayer = (chainId: number): Relayer.Rpc.RpcRelayer => {
    let relayer = relayers.get(chainId)

    if (!relayer) {
      const chain = getChain(chainId)
      const rpcUrl = chain.rpcUrls.default.http[0]

      let relayerUrl
      if (import.meta.env.VITE_ENV === 'local') {
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
      } else {
        // For cors-anywhere, dev, and production environments
        const baseUrl =
          import.meta.env.VITE_ENV === 'cors-anywhere'
            ? 'http://localhost:8080/https://'
            : import.meta.env.VITE_ENV === 'dev' && import.meta.env.VITE_USE_V3_RELAYERS === 'true'
              ? 'https://v3-'
              : import.meta.env.VITE_ENV === 'dev'
                ? 'https://dev-relayer.sequence.app'
                : 'https://'

        // Chain-specific relayer endpoints
        if (import.meta.env.VITE_ENV === 'dev' && import.meta.env.VITE_USE_V3_RELAYERS === 'true') {
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
        } else {
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
        }
      }

      relayer = new Relayer.Rpc.RpcRelayer(relayerUrl, chainId, rpcUrl)
      relayers.set(chainId, relayer)
    }

    return relayer
  }

  return {
    relayers,
    getRelayer,
    getBackupRelayer,
  }
}

export type { Relayer }
