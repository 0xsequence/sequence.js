import * as Db from '../../dbs/index.js'
import { Address, Hex } from 'ox'
import { SignerActionable, SignerReady, SignerUnavailable } from '../types/index.js'

export interface Handler {
  kind: string

  onStatusChange(cb: () => void): () => void

  status(
    address: Address.Address,
    imageHash: Hex.Hex | undefined,
    request: Db.SignatureRequest,
  ): Promise<SignerUnavailable | SignerReady | SignerActionable>
}
