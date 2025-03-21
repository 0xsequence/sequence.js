import { Signers } from '@0xsequence/sequence-core'
import { Logger } from './logger'

export class Devices {
  constructor(
    private readonly logger: Logger,
    private readonly encryptedPksDb: Signers.Pk.Encrypted.EncryptedPksDb,
  ) {}

  async create() {
    const e = await this.encryptedPksDb.generateAndStore()
    const s = await this.encryptedPksDb.getEncryptedPkStore(e.address)

    if (!s) {
      throw new Error('Failed to create session')
    }

    this.logger.log('Created new session:', s.address)
    return new Signers.Pk.Pk(s)
  }
}
