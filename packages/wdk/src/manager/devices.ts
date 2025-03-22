import { Signers, State } from '@0xsequence/sequence-core'
import { Logger } from './logger'
import { Address } from 'ox'
import { Kinds, WitnessExtraSignerKind } from './signers'

export class Devices {
  constructor(
    private readonly logger: Logger,
    private readonly stateProvider: State.Provider,
    private readonly encryptedPksDb: Signers.Pk.Encrypted.EncryptedPksDb,
  ) {}

  async list() {
    return this.encryptedPksDb.listAddresses()
  }

  async has(address: Address.Address) {
    const entry = await this.encryptedPksDb.getEncryptedEntry(address)
    return entry !== undefined
  }

  async create() {
    const e = await this.encryptedPksDb.generateAndStore()
    const s = await this.encryptedPksDb.getEncryptedPkStore(e.address)

    if (!s) {
      throw new Error('Failed to create session')
    }

    this.logger.log('Created new session:', s.address)
    return new Signers.Pk.Pk(s)
  }

  async get(address: Address.Address) {
    const s = await this.encryptedPksDb.getEncryptedPkStore(address)
    if (!s) {
      return undefined
    }

    return new Signers.Pk.Pk(s)
  }

  async witness(address: Address.Address, wallet: Address.Address) {
    const signer = await this.get(address)
    if (!signer) {
      throw new Error('Signer not found')
    }

    await signer.witness(this.stateProvider, wallet, {
      signerKind: Kinds.LocalDevice,
    } as WitnessExtraSignerKind)
  }
}
