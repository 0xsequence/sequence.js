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
  const data: any = {}

  switch (p.type()) {
    case 'native-balance': {
      const native = p as NativeBalancePrecondition
      data.address = native.address.toString()
      if (native.min !== undefined) data.min = native.min.toString()
      if (native.max !== undefined) data.max = native.max.toString()
      break
    }

    case 'erc20-balance': {
      const erc20 = p as Erc20BalancePrecondition
      data.address = erc20.address.toString()
      data.token = erc20.token.toString()
      if (erc20.min !== undefined) data.min = erc20.min.toString()
      if (erc20.max !== undefined) data.max = erc20.max.toString()
      break
    }

    case 'erc20-approval': {
      const erc20 = p as Erc20ApprovalPrecondition
      data.address = erc20.address.toString()
      data.token = erc20.token.toString()
      data.operator = erc20.operator.toString()
      data.min = erc20.min.toString()
      break
    }

    case 'erc721-ownership': {
      const erc721 = p as Erc721OwnershipPrecondition
      data.address = erc721.address.toString()
      data.token = erc721.token.toString()
      data.tokenId = erc721.tokenId.toString()
      if (erc721.owned !== undefined) data.owned = erc721.owned
      break
    }

    case 'erc721-approval': {
      const erc721 = p as Erc721ApprovalPrecondition
      data.address = erc721.address.toString()
      data.token = erc721.token.toString()
      data.tokenId = erc721.tokenId.toString()
      data.operator = erc721.operator.toString()
      break
    }

    case 'erc1155-balance': {
      const erc1155 = p as Erc1155BalancePrecondition
      data.address = erc1155.address.toString()
      data.token = erc1155.token.toString()
      data.tokenId = erc1155.tokenId.toString()
      if (erc1155.min !== undefined) data.min = erc1155.min.toString()
      if (erc1155.max !== undefined) data.max = erc1155.max.toString()
      break
    }

    case 'erc1155-approval': {
      const erc1155 = p as Erc1155ApprovalPrecondition
      data.address = erc1155.address.toString()
      data.token = erc1155.token.toString()
      data.tokenId = erc1155.tokenId.toString()
      data.operator = erc1155.operator.toString()
      data.min = erc1155.min.toString()
      break
    }
  }

  return JSON.stringify(data)
}
