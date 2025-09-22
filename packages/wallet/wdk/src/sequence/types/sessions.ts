import { Permission } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

export type ImplicitSession = {
  sessionAddress: Address.Address
  valueLimit: bigint
  deadline: bigint
}

export type ExplicitSession = {
  sessionAddress: Address.Address
  valueLimit: bigint
  deadline: bigint
  permissions: Permission.Permission[]
  chainId: number
}

export type ExplicitSessionConfig = {
  valueLimit: bigint
  deadline: bigint
  chainId: number
  permissions: Permission.Permission[]
}

export type ImplicitSessionConfig = {
  valueLimit: bigint
  deadline: bigint
}

export type AuthorizeImplicitSessionArgs = {
  target: string
  applicationData?: Hex.Hex
}
