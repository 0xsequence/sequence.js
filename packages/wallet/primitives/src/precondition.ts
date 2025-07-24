export interface Precondition {
  type: string
}

export interface NativeBalancePrecondition extends Precondition {
  type: 'native-balance'
  address: string
  min?: bigint
  max?: bigint
}

export interface Erc20BalancePrecondition extends Precondition {
  type: 'erc20-balance'
  address: string
  token: string
  min?: bigint
  max?: bigint
}

export interface Erc20ApprovalPrecondition extends Precondition {
  type: 'erc20-approval'
  address: string
  token: string
  operator: string
  min: bigint
}

export interface Erc721OwnershipPrecondition extends Precondition {
  type: 'erc721-ownership'
  address: string
  token: string
  tokenId: bigint
  owned?: boolean
}

export interface Erc721ApprovalPrecondition extends Precondition {
  type: 'erc721-approval'
  address: string
  token: string
  tokenId: bigint
  operator: string
}

export interface Erc1155BalancePrecondition extends Precondition {
  type: 'erc1155-balance'
  address: string
  token: string
  tokenId: bigint
  min?: bigint
  max?: bigint
}

export interface Erc1155ApprovalPrecondition extends Precondition {
  type: 'erc1155-approval'
  address: string
  token: string
  tokenId: bigint
  operator: string
  min: bigint
}

export type AnyPrecondition =
  | NativeBalancePrecondition
  | Erc20BalancePrecondition
  | Erc20ApprovalPrecondition
  | Erc721OwnershipPrecondition
  | Erc721ApprovalPrecondition
  | Erc1155BalancePrecondition
  | Erc1155ApprovalPrecondition

export function isValidPreconditionType(type: string): type is AnyPrecondition['type'] {
  return [
    'native-balance',
    'erc20-balance',
    'erc20-approval',
    'erc721-ownership',
    'erc721-approval',
    'erc1155-balance',
    'erc1155-approval',
  ].includes(type)
}

export function createPrecondition<T extends AnyPrecondition>(precondition: T): T {
  if (!precondition || typeof precondition.type !== 'string' || !isValidPreconditionType(precondition.type)) {
    throw new Error(`Invalid precondition object: missing or invalid 'type' property.`)
  }

  return precondition
}

export interface IntentPrecondition<T extends AnyPrecondition = AnyPrecondition> {
  type: T['type']
  data: Omit<T, 'type'>
  chainId?: bigint
}

export function createIntentPrecondition<T extends AnyPrecondition>(
  precondition: T,
  chainId?: bigint,
): IntentPrecondition<T> {
  const { type, ...data } = precondition

  if (!isValidPreconditionType(type)) {
    throw new Error(`Invalid precondition type: ${type}`)
  }

  return { type, data, ...(chainId !== undefined ? { chainId } : undefined) }
}
