import { Address, Bytes } from 'ox'
import { Shared } from './manager.js'
import * as Guard from '@0xsequence/guard'
import { Signers } from '@0xsequence/wallet-core'
import { Config, Constants } from '@0xsequence/wallet-primitives'

export type GuardRole = 'wallet' | 'sessions'

export class Guards {
  constructor(private readonly shared: Shared) {}

  getByRole(role: GuardRole): Signers.Guard {
    const guardAddress = this.shared.sequence.guardAddresses[role]
    if (!guardAddress) {
      throw new Error(`Guard address for role ${role} not found`)
    }

    return new Signers.Guard(new Guard.Sequence.Guard(this.shared.sequence.guardUrl, guardAddress))
  }

  getByAddress(address: Address.Address): [GuardRole, Signers.Guard] | undefined {
    const roles = Object.entries(this.shared.sequence.guardAddresses) as [GuardRole, Address.Address][]
    for (const [role, guardAddress] of roles) {
      if (Address.isEqual(guardAddress, address)) {
        return [role, this.getByRole(role)]
      }
    }

    // Wallets that have not migrated yet still reference a rotated-out guard,
    // the guard service keeps co-signing for those addresses until they migrate.
    const role = this.legacyRoleOf(address)
    if (role) {
      return [role, new Signers.Guard(new Guard.Sequence.Guard(this.shared.sequence.guardUrl, address))]
    }

    return undefined
  }

  legacyRoleOf(address: Address.Address): GuardRole | undefined {
    const roles = Object.entries(this.shared.sequence.legacyGuardAddresses) as [GuardRole, Address.Address[]][]
    for (const [role, legacyAddresses] of roles) {
      if (legacyAddresses.some((legacyAddress) => Address.isEqual(legacyAddress, address))) {
        return role
      }
    }
    return undefined
  }

  isGuard(address: Address.Address): boolean {
    return this.getByAddress(address) !== undefined
  }

  // Replaces every legacy guard address of the given role with the current guard address,
  // returns undefined if the topology does not reference any legacy guard of that role.
  migrateTopology(topology: Config.Topology, role: GuardRole): Config.Topology | undefined {
    const guardAddress = this.shared.sequence.guardAddresses[role]
    if (!guardAddress) {
      return undefined
    }

    let migrated = topology
    for (const legacyAddress of this.shared.sequence.legacyGuardAddresses[role] ?? []) {
      if (Address.isEqual(legacyAddress, guardAddress)) {
        continue
      }
      migrated = Config.replaceAddress(migrated, legacyAddress, guardAddress)
    }

    if (Bytes.isEqual(Config.hashConfiguration(migrated), Config.hashConfiguration(topology))) {
      return undefined
    }

    return migrated
  }

  topology(role: GuardRole): Config.Topology | undefined {
    const guardAddress = this.shared.sequence.guardAddresses[role]
    if (!guardAddress) {
      return undefined
    }

    const topology = Config.replaceAddress(
      this.shared.sequence.defaultGuardTopology,
      Constants.PlaceholderAddress,
      guardAddress,
    )

    // If the imageHash did not change it means the replacement failed
    if (
      Bytes.isEqual(
        Config.hashConfiguration(topology),
        Config.hashConfiguration(this.shared.sequence.defaultGuardTopology),
      )
    ) {
      throw new Error(`Guard address replacement failed for role ${role}`)
    }

    return topology
  }
}
