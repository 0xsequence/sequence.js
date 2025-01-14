import { ethers } from 'ethers'

import { proto } from './rpc-relayer'

export type Precondition =
  | NativeBalancePrecondition
  | Erc20BalancePrecondition
  | Erc20ApprovalPrecondition
  | Erc721OwnershipPrecondition
  | Erc721ApprovalPrecondition
  | Erc1155BalancePrecondition
  | Erc1155ApprovalPrecondition

export function isPrecondition(precondition: any): precondition is Precondition {
  return [
    isNativeBalancePrecondition,
    isErc20BalancePrecondition,
    isErc20ApprovalPrecondition,
    isErc721OwnershipPrecondition,
    isErc721ApprovalPrecondition,
    isErc1155BalancePrecondition,
    isErc1155ApprovalPrecondition
  ].some(predicate => predicate(precondition))
}

export function encodePrecondition(precondition: Precondition): proto.Precondition {
  if (isNativeBalancePrecondition(precondition)) {
    return encodeNativeBalancePrecondition(precondition)
  } else if (isErc20BalancePrecondition(precondition)) {
    return encodeErc20BalancePrecondition(precondition)
  } else if (isErc20ApprovalPrecondition(precondition)) {
    return encodeErc20ApprovalPrecondition(precondition)
  } else if (isErc721OwnershipPrecondition(precondition)) {
    return encodeErc721OwnershipPrecondition(precondition)
  } else if (isErc721ApprovalPrecondition(precondition)) {
    return encodeErc721ApprovalPrecondition(precondition)
  } else if (isErc1155BalancePrecondition(precondition)) {
    return encodeErc1155BalancePrecondition(precondition)
  } else if (isErc1155ApprovalPrecondition(precondition)) {
    return encodeErc1155ApprovalPrecondition(precondition)
  } else {
    throw new Error('unreachable')
  }
}

type NativeBalancePrecondition = {
  type: 'native-balance'
  address: `0x${string}`
  min?: ethers.BigNumberish
  max?: ethers.BigNumberish
}

function isNativeBalancePrecondition(precondition: any): precondition is NativeBalancePrecondition {
  return (
    typeof precondition === 'object' &&
    precondition &&
    precondition.type === 'native-balance' &&
    ethers.isAddress(precondition.address) &&
    (precondition.min === undefined || isBigNumberish(precondition.min)) &&
    (precondition.max === undefined || isBigNumberish(precondition.max))
  )
}

function encodeNativeBalancePrecondition(precondition: NativeBalancePrecondition): proto.Precondition {
  return {
    type: precondition.type,
    precondition: {
      ...precondition,
      type: undefined,
      min: encodeBigNumberish(precondition.min),
      max: encodeBigNumberish(precondition.max)
    }
  }
}

type Erc20BalancePrecondition = {
  type: 'erc20-balance'
  address: `0x${string}`
  token: `0x${string}`
  min?: ethers.BigNumberish
  max?: ethers.BigNumberish
}

function isErc20BalancePrecondition(precondition: any): precondition is Erc20BalancePrecondition {
  return (
    typeof precondition === 'object' &&
    precondition &&
    precondition.type === 'erc20-balance' &&
    ethers.isAddress(precondition.address) &&
    ethers.isAddress(precondition.token) &&
    (precondition.min === undefined || isBigNumberish(precondition.min)) &&
    (precondition.max === undefined || isBigNumberish(precondition.max))
  )
}

function encodeErc20BalancePrecondition(precondition: Erc20BalancePrecondition): proto.Precondition {
  return {
    type: precondition.type,
    precondition: {
      ...precondition,
      type: undefined,
      min: encodeBigNumberish(precondition.min),
      max: encodeBigNumberish(precondition.max)
    }
  }
}

type Erc20ApprovalPrecondition = {
  type: 'erc20-approval'
  address: `0x${string}`
  token: `0x${string}`
  operator: `0x${string}`
  min: ethers.BigNumberish
}

function isErc20ApprovalPrecondition(precondition: any): precondition is Erc20ApprovalPrecondition {
  return (
    typeof precondition === 'object' &&
    precondition &&
    precondition.type === 'erc20-approval' &&
    ethers.isAddress(precondition.address) &&
    ethers.isAddress(precondition.token) &&
    ethers.isAddress(precondition.operator) &&
    isBigNumberish(precondition.min)
  )
}

function encodeErc20ApprovalPrecondition(precondition: Erc20ApprovalPrecondition): proto.Precondition {
  return {
    type: precondition.type,
    precondition: { ...precondition, type: undefined, min: encodeBigNumberish(precondition.min) }
  }
}

type Erc721OwnershipPrecondition = {
  type: 'erc721-ownership'
  address: `0x${string}`
  token: `0x${string}`
  tokenId: ethers.BigNumberish
  owned?: boolean
}

function isErc721OwnershipPrecondition(precondition: any): precondition is Erc721OwnershipPrecondition {
  return (
    typeof precondition === 'object' &&
    precondition.type === 'erc721-ownership' &&
    ethers.isAddress(precondition.address) &&
    ethers.isAddress(precondition.token) &&
    isBigNumberish(precondition.tokenId) &&
    (precondition.owned === undefined || typeof precondition.owned === 'boolean')
  )
}

function encodeErc721OwnershipPrecondition(precondition: Erc721OwnershipPrecondition): proto.Precondition {
  return {
    type: precondition.type,
    precondition: {
      ...precondition,
      type: undefined,
      tokenId: encodeBigNumberish(precondition.tokenId),
      owned: precondition.owned !== false
    }
  }
}

type Erc721ApprovalPrecondition = {
  type: 'erc721-approval'
  address: `0x${string}`
  token: `0x${string}`
  tokenId: ethers.BigNumberish
  operator: `0x${string}`
}

function isErc721ApprovalPrecondition(precondition: any): precondition is Erc721ApprovalPrecondition {
  return (
    typeof precondition === 'object' &&
    precondition.type === 'erc721-approval' &&
    ethers.isAddress(precondition.address) &&
    ethers.isAddress(precondition.token) &&
    isBigNumberish(precondition.tokenId) &&
    ethers.isAddress(precondition.operator)
  )
}

function encodeErc721ApprovalPrecondition(precondition: Erc721ApprovalPrecondition): proto.Precondition {
  return {
    type: precondition.type,
    precondition: { ...precondition, type: undefined, tokenId: encodeBigNumberish(precondition.tokenId) }
  }
}

type Erc1155BalancePrecondition = {
  type: 'erc1155-balance'
  address: `0x${string}`
  token: `0x${string}`
  tokenId: ethers.BigNumberish
  min?: ethers.BigNumberish
  max?: ethers.BigNumberish
}

function isErc1155BalancePrecondition(precondition: any): precondition is Erc1155BalancePrecondition {
  return (
    typeof precondition === 'object' &&
    precondition &&
    precondition.type === 'erc1155-balance' &&
    ethers.isAddress(precondition.address) &&
    ethers.isAddress(precondition.token) &&
    isBigNumberish(precondition.tokenId) &&
    (precondition.min === undefined || isBigNumberish(precondition.min)) &&
    (precondition.max === undefined || isBigNumberish(precondition.max))
  )
}

function encodeErc1155BalancePrecondition(precondition: Erc1155BalancePrecondition): proto.Precondition {
  return {
    type: precondition.type,
    precondition: {
      ...precondition,
      type: undefined,
      tokenId: encodeBigNumberish(precondition.tokenId),
      min: encodeBigNumberish(precondition.min),
      max: encodeBigNumberish(precondition.max)
    }
  }
}

type Erc1155ApprovalPrecondition = {
  type: 'erc1155-approval'
  address: `0x${string}`
  token: `0x${string}`
  tokenId: ethers.BigNumberish
  operator: `0x${string}`
  min: ethers.BigNumberish
}

function isErc1155ApprovalPrecondition(precondition: any): precondition is Erc1155ApprovalPrecondition {
  return (
    typeof precondition === 'object' &&
    precondition &&
    precondition.type === 'erc1155-approval' &&
    ethers.isAddress(precondition.address) &&
    ethers.isAddress(precondition.token) &&
    isBigNumberish(precondition.tokenId) &&
    ethers.isAddress(precondition.operator) &&
    isBigNumberish(precondition.min)
  )
}

function encodeErc1155ApprovalPrecondition(precondition: Erc1155ApprovalPrecondition): proto.Precondition {
  return {
    type: precondition.type,
    precondition: {
      ...precondition,
      type: undefined,
      tokenId: encodeBigNumberish(precondition.tokenId),
      min: encodeBigNumberish(precondition.min)
    }
  }
}

function isBigNumberish(value: any): value is ethers.BigNumberish {
  try {
    ethers.toBigInt(value)
    return true
  } catch {
    return false
  }
}

function encodeBigNumberish<T extends ethers.BigNumberish | undefined>(
  value: T
): T extends ethers.BigNumberish ? string : undefined {
  return value !== undefined ? ethers.toBigInt(value).toString() : (undefined as any)
}
