import { Address, Provider } from 'ox'
import * as Db from '../dbs'
import { Network, Payload } from '@0xsequence/sequence-primitives'
import { Envelope, State, Wallet } from '@0xsequence/sequence-core'
import { v7 as uuidv7 } from 'uuid'

export class Signatures {
  constructor(
    private readonly signaturesDb: Db.Signatures,
    private readonly networks: Network.Network[],
    private readonly stateProvider: State.Provider,
  ) {}

  async list(): Promise<Db.SignatureRequest[]> {
    return this.signaturesDb.list()
  }

  async request(
    envelope: Envelope.Envelope<Payload.Payload>,
    options: {
      origin?: string
      reason?: string
    },
  ): Promise<string> {
    const id = uuidv7()

    await this.signaturesDb.set({
      id,
      wallet: envelope.wallet,
      envelope: Envelope.toSigned(envelope),
      origin: options.origin ?? 'unknown',
      reason: options.reason ?? 'unknown',
      status: 'pending',
    })

    return id
  }
}
