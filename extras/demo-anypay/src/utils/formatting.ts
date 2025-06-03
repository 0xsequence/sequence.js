import { formatUnits } from 'viem'
import * as chains from 'viem/chains'
import { TokenBalance, NativeTokenBalance } from '@anypay/sdk'

// Helper to get chain info
export const getChainInfo = (chainId: number) => {
  return Object.values(chains).find((chain) => chain.id === chainId) || null
}

export const formatBalance = (balance: TokenBalance | NativeTokenBalance): string => {
  try {
    const value = BigInt(balance.balance)
    let decimals: number
    let isNative = false

    if ('contractAddress' in balance) {
      decimals = balance.contractInfo?.decimals || 0
    } else {
      decimals = 18
      isNative = true
    }

    if (decimals === 0 && !isNative && value !== 0n) {
      return value.toString()
    }

    const formatted = formatUnits(value, decimals)
    const num = parseFloat(formatted)

    if (num === 0) return '0'
    // Use exponential for very small non-zero numbers
    if (Math.abs(num) < 0.00001 && num !== 0) return num.toExponential(2)

    let displayStr: string

    if (Math.abs(num) < 1 && num !== 0) {
      // Numbers between 0.00001 and 1 (exclusive of 0)
      displayStr = num.toFixed(6)
    } else if (Math.abs(num) < 1000) {
      // Numbers between 1 and 1000 (exclusive)
      displayStr = num.toFixed(4)
    } else {
      // Numbers >= 1000 or <= -1000
      displayStr = num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
      return parseFloat(num.toFixed(2)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    }

    if (displayStr.includes('.')) {
      displayStr = displayStr.replace(/0+$/, '')
      displayStr = displayStr.replace(/\.$/, '')
    }
    return displayStr
  } catch (e) {
    console.error('Error formatting balance:', e, balance)
    return balance.balance.toString() // Fallback to raw balance string
  }
}

// Helper to get explorer URL
export const getExplorerUrl = (chainId: number, address: string): string | null => {
  const chainInfo = getChainInfo(chainId)
  if (chainInfo && chainInfo.blockExplorers?.default?.url) {
    return `${chainInfo.blockExplorers.default.url}/address/${address}`
  }
  return null
}

export const getExplorerUrlForTransaction = (chainId: number, transactionHash: string): string | null => {
  const chainInfo = getChainInfo(chainId)
  if (chainInfo && chainInfo.blockExplorers?.default?.url) {
    return `${chainInfo.blockExplorers.default.url}/tx/${transactionHash}`
  }
  return null
}
