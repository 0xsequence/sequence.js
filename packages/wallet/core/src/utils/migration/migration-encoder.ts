// FIXME
// This contains logic for encoding a v2 transaction bundle to execution data.
// Ideally this would live in the migration package.
// We don't want core to depend on the migration package as the migration package depends on v2.

import { AbiFunction, Address, Hex } from 'ox'
import { State } from '../../index.js'
import { encodeTransactionBundleNonce } from '../../state/sequence/index.js'

const V2_EXECUTE_ABI = AbiFunction.from({
  type: 'function',
  name: 'execute',
  constant: false,
  inputs: [
    {
      components: [
        {
          type: 'bool',
          name: 'delegateCall',
        },
        {
          type: 'bool',
          name: 'revertOnError',
        },
        {
          type: 'uint256',
          name: 'gasLimit',
        },
        {
          type: 'address',
          name: 'target',
        },
        {
          type: 'uint256',
          name: 'value',
        },
        {
          type: 'bytes',
          name: 'data',
        },
      ],
      type: 'tuple[]',
    },
    {
      type: 'uint256',
    },
    {
      type: 'bytes',
    },
  ],
  outputs: [],
  payable: false,
  stateMutability: 'nonpayable',
})

export function encodeMigration(migration: State.Migration): {
  to: Address.Address
  data: Hex.Hex
} {
  if (migration.fromVersion === 1 || migration.fromVersion === 2) {
    const to = migration.payload.calls[0]?.to
    if (!to) {
      throw new Error('No to address found')
    }
    const v2Transactions = migration.payload.calls.map((call) => ({
      target: Address.from(call.to),
      data: call.data,
      value: call.value,
      gasLimit: call.gasLimit,
      delegateCall: call.delegateCall,
      revertOnError: call.behaviorOnError === 'revert',
    }))
    const v2Nonce = encodeTransactionBundleNonce(migration.payload.space, migration.payload.nonce)
    const data = AbiFunction.encodeData(V2_EXECUTE_ABI, [v2Transactions, BigInt(v2Nonce), migration.signature])
    return {
      to: Address.from(to),
      data,
    }
  }
  throw new Error(`Unsupported migration version ${migration.fromVersion}`)
}
