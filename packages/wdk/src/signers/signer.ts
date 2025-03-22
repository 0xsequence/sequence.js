import * as Db from '../dbs'
import { Address, Bytes } from 'ox'
import { SignerActionable, SignerReady, SignerUnavailable } from '../manager/signatures'
import { Envelope } from '@0xsequence/sequence-core'

export interface SignerHandler {
  kind: string

  uiStatus(): 'non-required' | 'non-registered' | 'registered'

  status(
    address: Address.Address,
    imageHash: Bytes.Bytes | undefined,
    request: Db.SignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable>
}
