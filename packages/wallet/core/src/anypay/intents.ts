import { Address, Bytes, ContractAddress, Hash } from 'ox'
import { Context, Config, Payload } from '@0xsequence/wallet-primitives'

export type IntentOperation = {
  chainId: bigint
  space?: bigint
  nonce?: bigint
  calls: {
    to: Address.Address
    value: bigint
    data: Bytes.Bytes
    gasLimit: bigint
    delegateCall: boolean
    onlyFallback: boolean
    behaviorOnError: bigint
  }[]
}

export function calculateIntentConfigurationAddress(
  operations: IntentOperation[],
  mainSigner: Address.Address,
  context: Context.Context,
): Address.Address {
  // Create the intent configuration
  const config = createIntentConfiguration(operations, mainSigner)

  // Calculate the image hash of the configuration
  const imageHash = Config.hashConfiguration(config)

  // Calculate the counterfactual address using the image hash and context
  return ContractAddress.fromCreate2({
    from: context.factory,
    bytecodeHash: Hash.keccak256(
      Bytes.concat(Bytes.from(context.creationCode), Bytes.padLeft(Bytes.from(context.stage1), 32)),
      { as: 'Bytes' },
    ),
    salt: imageHash,
  })
}

function createIntentConfiguration(operations: IntentOperation[], mainSigner: Address.Address): Config.Config {
  // Create the main signer leaf
  const mainSignerLeaf: Config.SignerLeaf = {
    type: 'signer',
    address: mainSigner,
    weight: 1n,
  }

  // Create subdigest leaves for each operation
  const subdigestLeaves = operations.map((op) => {
    // Create the calls payload
    const payload: Payload.Calls = {
      type: 'call',
      space: op.space ?? 0n,
      nonce: op.nonce ?? 0n,
      calls: op.calls.map((call) => ({
        to: call.to,
        value: call.value,
        data: Bytes.toHex(call.data),
        gasLimit: call.gasLimit,
        delegateCall: call.delegateCall,
        onlyFallback: call.onlyFallback,
        behaviorOnError: call.behaviorOnError === 0n ? 'ignore' : call.behaviorOnError === 1n ? 'revert' : 'abort',
      })),
    }

    // Get the digest hash using Payload.hash
    const digest = Payload.hash(Address.from('0x0000000000000000000000000000000000000000'), op.chainId, payload)
    console.log('digest:', Bytes.toHex(digest))

    // Create subdigest leaf
    return {
      type: 'any-address-subdigest',
      digest: Bytes.toHex(digest),
    } as Config.AnyAddressSubdigestLeaf
  })

  // If there's only one operation, use its subdigest leaf directly
  if (subdigestLeaves.length === 1) {
    return {
      threshold: 1n,
      checkpoint: 0n,
      topology: [mainSignerLeaf, subdigestLeaves[0]] as Config.Topology,
    }
  }

  // Otherwise, create a tree of subdigest leaves
  const subdigestTree = createSubdigestTree(subdigestLeaves)

  return {
    threshold: 1n,
    checkpoint: 0n,
    topology: [mainSignerLeaf, subdigestTree] as Config.Topology,
  }
}

function createSubdigestTree(leaves: Config.AnyAddressSubdigestLeaf[]): Config.Topology {
  if (leaves.length === 0) {
    throw new Error('Cannot create a tree from empty leaves')
  }

  if (leaves.length === 1) {
    return leaves[0]!
  }

  const mid = Math.floor(leaves.length / 2)
  const left = createSubdigestTree(leaves.slice(0, mid))
  const right = createSubdigestTree(leaves.slice(mid))

  return [left, right]
}
