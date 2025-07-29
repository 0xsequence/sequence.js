import { Signers } from '@0xsequence/wallet-core'
import { Address } from '@0xsequence/wallet-primitives'
import { Kinds, WitnessExtraSignerKind } from './types/signer.js'
import { Shared } from './manager.js'

export class Devices {
  constructor(private readonly shared: Shared) {}

  async list() {
    return this.shared.databases.encryptedPks.listAddresses()
  }

  async has(address: Address.Checksummed) {
    const entry = await this.shared.databases.encryptedPks.getEncryptedEntry(address)
    return entry !== undefined
  }

  async create() {
    const e = await this.shared.databases.encryptedPks.generateAndStore()
    const s = await this.shared.databases.encryptedPks.getEncryptedPkStore(e.address)

    if (!s) {
      throw new Error('Failed to create session')
    }

    this.shared.modules.logger.log('Created new session:', s.address)
    return new Signers.Pk.Pk(s)
  }

  async get(address: Address.Checksummed) {
    const s = await this.shared.databases.encryptedPks.getEncryptedPkStore(address)
    if (!s) {
      return undefined
    }

    return new Signers.Pk.Pk(s)
  }

  async witness(address: Address.Checksummed, wallet: Address.Checksummed) {
    const signer = await this.get(address)
    if (!signer) {
      throw new Error('Signer not found')
    }

    await signer.witness(this.shared.sequence.stateProvider, wallet, {
      signerKind: Kinds.LocalDevice,
    } as WitnessExtraSignerKind)
  }

  async remove(address: Address.Checksummed) {
    await this.shared.databases.encryptedPks.remove(address)
  }
}
