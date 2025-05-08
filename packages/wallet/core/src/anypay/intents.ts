import { AbiParameters, Address, Bytes, ContractAddress, Hash, Hex } from 'ox'
import { Context, Config, Payload } from '@0xsequence/wallet-primitives'

export interface IntentCallsPayload extends Payload.Calls {
  chainId: bigint
}

export function hashIntentParams(params: {
  userAddress: Address.Address
  originChainId: bigint
  originTokenAddress: Address.Address
  destinationCalls: Array<IntentCallsPayload>
}): string {
  if (!params) throw new Error('params is nil')
  if (!params.userAddress || params.userAddress === '0x0000000000000000000000000000000000000000')
    throw new Error('UserAddress is zero')
  if (!params.originChainId || params.originChainId === 0n) throw new Error('OriginChainId is zero')
  if (!params.originTokenAddress || params.originTokenAddress === '0x0000000000000000000000000000000000000000')
    throw new Error('OriginTokenAddress is zero')
  if (!params.destinationCalls || params.destinationCalls.length === 0) throw new Error('DestinationCalls is empty')
  for (let i = 0; i < params.destinationCalls.length; i++) {
    if (!params.destinationCalls[i]) throw new Error(`DestinationCalls[${i}] is nil`)
  }

  // ABI encode the fields in a deterministic order
  let callsEncoded = Bytes.fromHex('0x')
  for (const call of params.destinationCalls) {
    callsEncoded = Bytes.concat(
      callsEncoded,
      Payload.encode(call, Address.from('0x0000000000000000000000000000000000000000')),
    )
  }

  // ABI encode: address, uint256, address, bytes
  const encoded = AbiParameters.encode(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'address' }, { type: 'bytes' }],
    [params.userAddress, params.originChainId, params.originTokenAddress, Hex.fromBytes(callsEncoded) as Hex.Hex],
  )

  return Hash.keccak256(encoded)
}

export function calculateIntentConfigurationAddress(
  mainSigner: Address.Address,
  calls: IntentCallsPayload[],
  context: Context.Context,
): Address.Address {
  // Create the intent configuration
  const config = createIntentConfiguration(mainSigner, calls)

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

function createIntentConfiguration(mainSigner: Address.Address, calls: IntentCallsPayload[]): Config.Config {
  // Create the main signer leaf
  const mainSignerLeaf: Config.SignerLeaf = {
    type: 'signer',
    address: mainSigner,
    weight: 1n,
  }

  // Create subdigest leaves for each operation
  const subdigestLeaves = calls.map((call) => {
    // Get the digest hash using Payload.hash
    const digest = Payload.hash(Address.from('0x0000000000000000000000000000000000000000'), call.chainId, call)
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
