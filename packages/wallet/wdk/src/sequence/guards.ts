import { Address, Secp256k1 } from 'ox'
import { Shared } from './manager.js'
import * as Guard from '@0xsequence/guard'
import { Signers } from '@0xsequence/wallet-core'
import { Config } from '@0xsequence/wallet-primitives'

export enum GuardRole {
  Wallet = 'wallet',
  Sessions = 'sessions',
}

export class Guards {
  constructor(private readonly shared: Shared) {}

  getByRole(role: GuardRole) {
    const guardAddress = this.shared.sequence.guardAddresses.get(role)
    if (!guardAddress) {
      throw new Error(`Guard address for role ${role} not found`)
    }

    return new Signers.Guard(new Guard.Sequence.Guard(this.shared.sequence.guardUrl, guardAddress))
  }

  getByAddress(address: Address.Address): [GuardRole, Signers.Guard] | undefined {
    for (const [role, guardAddress] of this.shared.sequence.guardAddresses.entries()) {
      if (guardAddress === address) {
        return [role, this.getByRole(role)]
      }
    }
    return undefined
  }

  topology(role: GuardRole): Config.NestedLeaf | undefined {
    const guardAddress = this.shared.sequence.guardAddresses.get(role)
    if (!guardAddress) {
      return undefined
    }

    return {
      type: 'nested',
      weight: 1n,
      threshold: 1n,
      tree: { ...this.shared.sequence.defaultGuardTopology, address: guardAddress },
    }
  }
}
