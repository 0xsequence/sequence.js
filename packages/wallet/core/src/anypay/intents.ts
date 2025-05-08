import { AbiParameters, Address, Bytes, ContractAddress, Hash, Hex } from 'ox'
import { Context, Config, Payload } from '@0xsequence/wallet-primitives'

export interface IntentCallsPayload extends Payload.Calls {
  chainId: bigint
}

export interface OriginTokenParam {
  address: Address.Address
  chainId: bigint
}

export interface DestinationTokenParam {
  address: Address.Address
  chainId: bigint
  amount: bigint
}

export function hashIntentParams(params: {
  userAddress: Address.Address
  originTokens: OriginTokenParam[]
  destinationCalls: Array<IntentCallsPayload>
  destinationTokens: DestinationTokenParam[]
}): string {
  if (!params) throw new Error('params is nil')
  if (!params.userAddress || params.userAddress === '0x0000000000000000000000000000000000000000')
    throw new Error('UserAddress is zero')
  if (!params.originTokens || params.originTokens.length === 0) throw new Error('OriginTokens is empty')
  if (!params.destinationCalls || params.destinationCalls.length === 0) throw new Error('DestinationCalls is empty')
  if (!params.destinationTokens || params.destinationTokens.length === 0) throw new Error('DestinationTokens is empty')
  for (let i = 0; i < params.destinationCalls.length; i++) {
    if (!params.destinationCalls[i]) throw new Error(`DestinationCalls[${i}] is nil`)
  }

  const originTokensForAbi = params.originTokens.map((token) => ({
    address: token.address,
    chainId: token.chainId, // Pass bigint, AbiParameters.encode handles for uint256
  }))

  const destinationCallsForAbi = params.destinationCalls.map(
    (callPayload) =>
      Bytes.toHex(Payload.encode(callPayload, Address.from('0x0000000000000000000000000000000000000000'))) as Hex.Hex, // Ensure it's a hex string for AbiParameters.encode
  )

  const destinationTokensForAbi = params.destinationTokens.map((token) => ({
    address: token.address,
    chainId: token.chainId, // Pass bigint
    amount: token.amount, // Pass bigint
  }))

  const abiSchema = [
    { type: 'address' },
    {
      type: 'tuple[]',
      components: [
        { name: 'address', type: 'address' },
        { name: 'chainId', type: 'uint256' },
      ],
    },
    { type: 'bytes[]' },
    {
      type: 'tuple[]',
      components: [
        { name: 'address', type: 'address' },
        { name: 'chainId', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
      ],
    },
  ]

  const encodedHex = AbiParameters.encode(abiSchema, [
    params.userAddress,
    originTokensForAbi,
    destinationCallsForAbi, // Now an array of Hex.Hex strings
    destinationTokensForAbi,
  ]) as Hex.Hex // Assume AbiParameters.encode returns Hex.Hex

  // Debug logging
  function bigintReplacer(_key: string, value: any) {
    return typeof value === 'bigint' ? value.toString() : value
  }

  console.log('hashIntentParams debug (TS standard ABI):')
  console.log('  userAddress:', params.userAddress)
  console.log('  originTokensForAbi:', JSON.stringify(originTokensForAbi, bigintReplacer, 2))
  console.log(
    '  destinationCallsForAbi (lengths):',
    destinationCallsForAbi.map((d) => d.length),
  )
  // To log actual hex of destinationCallsForAbi, map Bytes.toHex over it
  // console.log('  destinationCallsForAbi (hex):', destinationCallsForAbi.map(d => Bytes.toHex(d)))
  console.log('  destinationTokensForAbi:', JSON.stringify(destinationTokensForAbi, bigintReplacer, 2))
  console.log('  ABI-encoded (hex):', encodedHex)
  console.log('  ABI-encoded (length is hex string length):', encodedHex.length)

  const encodedBytes = Bytes.fromHex(encodedHex) // Convert to Bytes for hashing
  const hashBytes = Hash.keccak256(encodedBytes) // This produces Bytes.Bytes
  // console.log('  Hash (raw bytes):', hashBytes)
  const hashHex = Bytes.toHex(hashBytes) // Convert Bytes.Bytes to Hex.Hex string
  console.log('  Hash:', hashHex)

  return hashHex // Return the Hex.Hex string
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
