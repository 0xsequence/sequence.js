import { Address } from 'ox'
import {
  Precondition,
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  Erc721ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc1155ApprovalPrecondition,
} from './types.js'

export interface TransactionPrecondition {
  type: string
  chainId: number
  ownerAddress: string
  tokenAddress: string
  minAmount: bigint
}

export function decodePreconditions(preconditions: TransactionPrecondition[]): Precondition[] {
  const decodedPreconditions: Precondition[] = []

  for (const p of preconditions) {
    const decoded = decodePrecondition(p)
    if (decoded) {
      decodedPreconditions.push(decoded)
    }
  }

  return decodedPreconditions
}

export function decodePrecondition(p: TransactionPrecondition): Precondition | undefined {
  if (!p) {
    return undefined
  }

  if (typeof p.minAmount !== 'bigint') {
    console.warn(`Failed to decode precondition: minAmount must be a bigint`)
    return undefined
  }

  let precondition: Precondition | undefined

  try {
    switch (p.type) {
      case 'native-balance':
        precondition = new NativeBalancePrecondition(Address.from(p.ownerAddress), p.minAmount, undefined)
        break

      case 'erc20-balance':
        precondition = new Erc20BalancePrecondition(
          Address.from(p.ownerAddress),
          Address.from(p.tokenAddress),
          p.minAmount,
          undefined,
        )
        break

      case 'erc20-approval':
        precondition = new Erc20ApprovalPrecondition(
          Address.from(p.ownerAddress),
          Address.from(p.tokenAddress),
          Address.from(p.ownerAddress),
          p.minAmount,
        )
        break

      case 'erc721-ownership':
        precondition = new Erc721OwnershipPrecondition(
          Address.from(p.ownerAddress),
          Address.from(p.tokenAddress),
          BigInt(0),
          true,
        )
        break

      case 'erc721-approval':
        precondition = new Erc721ApprovalPrecondition(
          Address.from(p.ownerAddress),
          Address.from(p.tokenAddress),
          BigInt(0),
          Address.from(p.ownerAddress),
        )
        break

      case 'erc1155-balance':
        precondition = new Erc1155BalancePrecondition(
          Address.from(p.ownerAddress),
          Address.from(p.tokenAddress),
          BigInt(0),
          p.minAmount,
          undefined,
        )
        break

      case 'erc1155-approval':
        precondition = new Erc1155ApprovalPrecondition(
          Address.from(p.ownerAddress),
          Address.from(p.tokenAddress),
          BigInt(0),
          Address.from(p.ownerAddress),
          p.minAmount,
        )
        break

      default:
        return undefined
    }

    const error = precondition.isValid()
    if (error) {
      console.warn(`Invalid precondition: ${error.message}`)
      return undefined
    }

    return precondition
  } catch (e) {
    console.warn(`Failed to decode precondition: ${e}`)
    return undefined
  }
}

export function encodePrecondition(p: Precondition): string {
  switch (p.type()) {
    case 'native-balance': {
      const native = p as NativeBalancePrecondition
      const data = {
        address: native.address.toString(),
        ...(native.min !== undefined && { min: native.min.toString() }),
        ...(native.max !== undefined && { max: native.max.toString() }),
      }

      return JSON.stringify(data)
    }

    case 'erc20-balance': {
      const erc20 = p as Erc20BalancePrecondition
      const data = {
        address: erc20.address.toString(),
        token: erc20.token.toString(),
        ...(erc20.min !== undefined && { min: erc20.min.toString() }),
        ...(erc20.max !== undefined && { max: erc20.max.toString() }),
      }

      return JSON.stringify(data)
    }

    case 'erc20-approval': {
      const erc20 = p as Erc20ApprovalPrecondition
      const data = {
        address: erc20.address.toString(),
        token: erc20.token.toString(),
        operator: erc20.operator.toString(),
        min: erc20.min.toString(),
      }

      return JSON.stringify(data)
    }

    case 'erc721-ownership': {
      const erc721 = p as Erc721OwnershipPrecondition
      const data = {
        address: erc721.address.toString(),
        token: erc721.token.toString(),
        tokenId: erc721.tokenId.toString(),
        ...(erc721.owned !== undefined && { owned: erc721.owned }),
      }

      return JSON.stringify(data)
    }

    case 'erc721-approval': {
      const erc721 = p as Erc721ApprovalPrecondition
      const data = {
        address: erc721.address.toString(),
        token: erc721.token.toString(),
        tokenId: erc721.tokenId.toString(),
        operator: erc721.operator.toString(),
      }

      return JSON.stringify(data)
    }

    case 'erc1155-balance': {
      const erc1155 = p as Erc1155BalancePrecondition
      const data = {
        address: erc1155.address.toString(),
        token: erc1155.token.toString(),
        tokenId: erc1155.tokenId.toString(),
        ...(erc1155.min !== undefined && { min: erc1155.min.toString() }),
        ...(erc1155.max !== undefined && { max: erc1155.max.toString() }),
      }

      return JSON.stringify(data)
    }

    case 'erc1155-approval': {
      const erc1155 = p as Erc1155ApprovalPrecondition
      const data = {
        address: erc1155.address.toString(),
        token: erc1155.token.toString(),
        tokenId: erc1155.tokenId.toString(),
        operator: erc1155.operator.toString(),
        min: erc1155.min.toString(),
      }

      return JSON.stringify(data)
    }
  }

  return JSON.stringify({})
}
