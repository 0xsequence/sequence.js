/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ExplicitSessionConfig } from '@0xsequence/wallet-core'
import { Network, Permission } from '@0xsequence/wallet-primitives'
import { Bytes, Hex, type Address } from 'ox'
export { VALUE_FORWARDER_ADDRESS } from './constants.js'

type JsonReplacer = (key: string, value: any) => any
type JsonReviver = (key: string, value: any) => any

/**
 * Creates a single JSON replacer by chaining multiple replacers.
 * The first replacer to transform a value wins.
 */
function chainReplacers(replacers: JsonReplacer[]): JsonReplacer {
  return function (key: string, value: any): any {
    for (const replacer of replacers) {
      const replacedValue = replacer(key, value)
      if (replacedValue !== value) {
        return replacedValue
      }
    }
    return value
  }
}

/**
 * Creates a single JSON reviver by chaining multiple revivers.
 * The output of one reviver becomes the input for the next.
 */
function chainRevivers(revivers: JsonReviver[]): JsonReviver {
  return function (key: string, value: any): any {
    let currentValue = value
    for (const reviver of revivers) {
      currentValue = reviver(key, currentValue)
    }
    return currentValue
  }
}

/**
 * A JSON replacer that serializes Map objects into a structured object.
 */
const mapReplacer: JsonReplacer = (key, value) => {
  if (value instanceof Map) {
    return {
      _isMap: true,
      data: Array.from(value.entries()),
    }
  }
  return value
}

/**
 * A JSON replacer that serializes BigInt values into a structured object.
 */
const bigIntReplacer: JsonReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return {
      _isBigInt: true,
      data: value.toString(),
    }
  }
  return value
}

/**
 * A JSON replacer that serializes Uint8Array values into a structured object.
 */
const uint8ArrayReplacer: JsonReplacer = (key, value) => {
  if (value instanceof Uint8Array) {
    return {
      _isUint8Array: true,
      data: Hex.from(value),
    }
  }
  return value
}

/**
 * A JSON reviver that deserializes a structured object back into a Map.
 */
const mapReviver: JsonReviver = (key, value) => {
  if (value !== null && typeof value === 'object' && value._isMap === true && Array.isArray(value.data)) {
    try {
      // The key-value pairs in value.data will have already been processed
      // by other revivers in the chain because JSON.parse works bottom-up.
      return new Map(value.data)
    } catch (e) {
      console.error(`Failed to revive Map for key "${key}":`, e)
      return value // Return original object if revival fails
    }
  }
  return value
}

/**
 * A JSON reviver that deserializes a structured object back into a BigInt.
 */
const bigIntReviver: JsonReviver = (key, value) => {
  if (value !== null && typeof value === 'object' && value._isBigInt === true && typeof value.data === 'string') {
    try {
      return BigInt(value.data)
    } catch (e) {
      console.error(`Failed to revive BigInt for key "${key}":`, e)
      return value // Return original object if revival fails
    }
  }
  return value
}

/**
 * A JSON reviver that deserializes a structured object back into a Uint8Array.
 */
const uint8ArrayReviver: JsonReviver = (key, value) => {
  if (value !== null && typeof value === 'object' && value._isUint8Array === true && typeof value.data === 'string') {
    try {
      return Bytes.from(value.data)
    } catch (e) {
      console.error(`Failed to revive Uint8Array for key "${key}":`, e)
      return value // Return original object if revival fails
    }
  }
  return value
}

export const jsonRevivers = chainRevivers([mapReviver, bigIntReviver, uint8ArrayReviver])
export const jsonReplacers = chainReplacers([mapReplacer, bigIntReplacer, uint8ArrayReplacer])

export type SessionDuration = {
  days?: number
  hours?: number
  minutes?: number
}

export type NativeTokenSpending = {
  valueLimit: bigint
  allowedRecipients?: Address.Address[]
}

export type ExplicitSessionParams = {
  chainId: number
  expiresIn: SessionDuration
  permissions: Permission.Permission[]
  nativeTokenSpending?: NativeTokenSpending
}

export const createExplicitSessionConfig = (params: ExplicitSessionParams): ExplicitSessionConfig => {
  const nowInSeconds = BigInt(Math.floor(Date.now() / 1000))
  const { days = 0, hours = 0, minutes = 0 } = params.expiresIn
  const sessionLifetimeSeconds = days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60
  const deadline = nowInSeconds + BigInt(sessionLifetimeSeconds)

  if (params.permissions.length === 0) {
    throw new Error('createExplicitSessionConfig: At least one permission is required.')
  }

  const nativeTokenSpending = params.nativeTokenSpending
  const valueLimit = nativeTokenSpending?.valueLimit ?? 0n
  const nativeTokenReceivers = [...(nativeTokenSpending?.allowedRecipients || [])]
  const nativeTokenSpendingPermissions = nativeTokenReceivers.map((receiver) => ({
    target: receiver,
    rules: [],
  }))

  return {
    chainId: params.chainId,
    valueLimit,
    deadline,
    permissions: [...params.permissions, ...nativeTokenSpendingPermissions],
  }
}

/**
 * Apply a template to a string.
 *
 * Example:
 * applyTemplate('https://v3-{network}-relayer.sequence.app', { network: 'arbitrum' })
 * returns 'https://v3-arbitrum-relayer.sequence.app'
 *
 * @param template - The template to apply.
 * @param values - The values to apply to the template.
 * @returns The template with the values applied.
 */
function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{(.*?)}/g, (_, key) => {
    const value = values[key]
    if (value === undefined) {
      throw new Error(`Missing template value for ${template}: ${key}`)
    }
    return value
  })
}

export const getNetwork = (chainId: Network.ChainId | bigint | number) => {
  const network = Network.getNetworkFromChainId(chainId)

  if (!network) {
    throw new Error(`Network with chainId ${chainId} not found`)
  }

  return network
}

export const getRpcUrl = (chainId: Network.ChainId | bigint | number, nodesUrl: string, projectAccessKey: string) => {
  const network = getNetwork(chainId)

  let url = applyTemplate(nodesUrl, { network: network.name })

  if (nodesUrl.includes('sequence')) {
    url = `${url}/${projectAccessKey}`
  }

  return url
}

export const getRelayerUrl = (chainId: Network.ChainId | bigint | number, relayerUrl: string) => {
  const network = getNetwork(chainId)

  const url = applyTemplate(relayerUrl, { network: network.name })

  return url
}

export const getExplorerUrl = (chainId: Network.ChainId | bigint | number, txHash: string) => {
  const network = getNetwork(chainId)
  const explorerUrl = network.blockExplorer?.url
  if (!explorerUrl) {
    throw new Error(`Explorer URL not found for chainId ${chainId}`)
  }

  return `${explorerUrl}/tx/${txHash}`
}
