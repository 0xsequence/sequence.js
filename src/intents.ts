import { SequenceAPIClient } from '@0xsequence/api'
import {
  IntentPrecondition,
  GetIntentCallsPayloadsArgs,
  GetIntentCallsPayloadsReturn,
  CommitIntentConfigReturn,
} from '@0xsequence/api'
import { Context as ContextLike } from '@0xsequence/wallet-primitives'
import { AbiParameters, Address, Bytes, ContractAddress, Hash, Hex } from 'ox'
import { Context, Config, Payload } from '@0xsequence/wallet-primitives'
import { ANYPAY_LIFI_SAPIENT_SIGNER_LITE_ADDRESS } from './constants.js'
import { isAddressEqual, WalletClient, Chain, Account } from 'viem'
import { findPreconditionAddress } from './preconditions.js'

export interface AnypayLifiInfo {
  originToken: Address.Address
  amount: bigint
  originChainId: bigint
  destinationChainId: bigint
}

export interface IntentCallsPayload extends Payload.Calls {
  chainId: bigint
}

export { type GetIntentCallsPayloadsReturn }

export type OriginCallParams = {
  to: `0x${string}` | null
  data: Hex.Hex | null
  value: bigint | null
  chainId: number | null
  error?: string
}

export type SendOriginCallTxArgs = {
  to: string
  data: Hex.Hex
  value: bigint
  chain: Chain
}

export async function getIntentCallsPayloads(
  apiClient: SequenceAPIClient,
  args: GetIntentCallsPayloadsArgs,
): Promise<GetIntentCallsPayloadsReturn> {
  return apiClient.getIntentCallsPayloads(args as any) // TODO: Add proper type
}

export function calculateIntentAddress(
  mainSigner: string,
  calls: IntentCallsPayload[],
  lifiInfosArg: AnypayLifiInfo[] | null | undefined,
): `0x${string}` {
  console.log('calculateIntentAddress inputs:', {
    mainSigner,
    calls: JSON.stringify(calls, null, 2),
    lifiInfosArg: JSON.stringify(lifiInfosArg, null, 2),
  })

  const context: ContextLike.Context = {
    factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447' as `0x${string}`,
    stage1: '0x53bA242E7C2501839DF2972c75075dc693176Cd0' as `0x${string}`,
    stage2: '0xa29874c88b8Fd557e42219B04b0CeC693e1712f5' as `0x${string}`,
    creationCode:
      '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as `0x${string}`,
  }

  const coreCalls = calls.map((call) => ({
    type: 'call' as const,
    chainId: BigInt(call.chainId),
    space: call.space ? BigInt(call.space) : 0n,
    nonce: call.nonce ? BigInt(call.nonce) : 0n,
    calls: call.calls.map((call) => ({
      to: Address.from(call.to),
      value: BigInt(call.value || '0'),
      data: Bytes.toHex(Bytes.from((call.data as Hex.Hex) || '0x')),
      gasLimit: BigInt(call.gasLimit || '0'),
      delegateCall: !!call.delegateCall,
      onlyFallback: !!call.onlyFallback,
      behaviorOnError: (Number(call.behaviorOnError) === 0
        ? 'ignore'
        : Number(call.behaviorOnError) === 1
          ? 'revert'
          : 'abort') as 'ignore' | 'revert' | 'abort',
    })),
  }))

  //console.log('Transformed coreCalls:', JSON.stringify(coreCalls, null, 2))

  const coreLifiInfos = lifiInfosArg?.map((info: AnypayLifiInfo) => ({
    originToken: Address.from(info.originToken),
    amount: BigInt(info.amount),
    originChainId: BigInt(info.originChainId),
    destinationChainId: BigInt(info.destinationChainId),
  }))

  console.log(
    'Transformed coreLifiInfos:',
    JSON.stringify(coreLifiInfos, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2),
  )

  const calculatedAddress = calculateIntentConfigurationAddress(
    Address.from(mainSigner),
    coreCalls,
    context,
    // AnyPay.ANYPAY_LIFI_ATTESATION_SIGNER_ADDRESS,
    Address.from('0x0000000000000000000000000000000000000001'),
    coreLifiInfos,
  )

  console.log('Final calculated address:', calculatedAddress.toString())
  return calculatedAddress
}

export function commitIntentConfig(
  apiClient: SequenceAPIClient,
  mainSigner: string,
  calls: IntentCallsPayload[],
  preconditions: IntentPrecondition[],
  lifiInfos: AnypayLifiInfo[],
): Promise<CommitIntentConfigReturn> {
  console.log('commitIntentConfig inputs:', {
    mainSigner,
    calls: JSON.stringify(calls, null, 2),
    preconditions: JSON.stringify(preconditions, null, 2),
    lifiInfos: JSON.stringify(lifiInfos, null, 2),
  })

  const calculatedAddress = calculateIntentAddress(mainSigner, calls, lifiInfos)
  const receivedAddress = findPreconditionAddress(preconditions)
  console.log('Address comparison:', {
    receivedAddress,
    calculatedAddress: calculatedAddress.toString(),
    match: isAddressEqual(Address.from(receivedAddress), calculatedAddress),
  })

  const args = {
    walletAddress: calculatedAddress.toString(),
    mainSigner: mainSigner,
    calls: calls,
    preconditions: preconditions,
    lifiInfos: lifiInfos,
  }
  console.log('args', args)
  return apiClient.commitIntentConfig(args as any) // TODO: Add proper type
}

export async function sendOriginTransaction(
  wallet: Account,
  client: WalletClient,
  originParams: SendOriginCallTxArgs,
): Promise<`0x${string}`> {
  const hash = await client.sendTransaction({
    account: wallet,
    to: originParams.to as `0x${string}`,
    data: originParams.data as `0x${string}`,
    value: BigInt(originParams.value),
    chain: originParams.chain,
  })
  return hash
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
  nonce: bigint
  originTokens: OriginTokenParam[]
  destinationCalls: Array<IntentCallsPayload>
  destinationTokens: DestinationTokenParam[]
}): string {
  if (!params) throw new Error('params is nil')
  if (!params.userAddress || params.userAddress === '0x0000000000000000000000000000000000000000')
    throw new Error('UserAddress is zero')
  if (typeof params.nonce !== 'bigint') throw new Error('Nonce is not a bigint')
  if (!params.originTokens || params.originTokens.length === 0) throw new Error('OriginTokens is empty')
  if (!params.destinationCalls || params.destinationCalls.length === 0) throw new Error('DestinationCalls is empty')
  if (!params.destinationTokens || params.destinationTokens.length === 0) throw new Error('DestinationTokens is empty')
  for (let i = 0; i < params.destinationCalls.length; i++) {
    const currentCall = params.destinationCalls[i]
    if (!currentCall) throw new Error(`DestinationCalls[${i}] is nil`)
    if (!currentCall.calls || currentCall.calls.length === 0) {
      throw new Error(`DestinationCalls[${i}] has no calls`)
    }
  }

  const originTokensForAbi = params.originTokens.map((token) => ({
    address: token.address,
    chainId: token.chainId,
  }))

  let cumulativeCallsHashBytes: Bytes.Bytes = Bytes.from(new Uint8Array(32))

  for (let i = 0; i < params.destinationCalls.length; i++) {
    const callPayload = params.destinationCalls[i]!

    const currentDestCallPayloadHashBytes = Payload.hash(
      Address.from('0x0000000000000000000000000000000000000000'),
      callPayload.chainId,
      callPayload,
    )

    cumulativeCallsHashBytes = Hash.keccak256(Bytes.concat(cumulativeCallsHashBytes, currentDestCallPayloadHashBytes), {
      as: 'Bytes',
    })
  }
  const cumulativeCallsHashHex = Bytes.toHex(cumulativeCallsHashBytes)

  const destinationTokensForAbi = params.destinationTokens.map((token) => ({
    address: token.address,
    chainId: token.chainId,
    amount: token.amount,
  }))

  const abiSchema = [
    { type: 'address' },
    { type: 'uint256' },
    {
      type: 'tuple[]',
      components: [
        { name: 'address', type: 'address' },
        { name: 'chainId', type: 'uint256' },
      ],
    },
    {
      type: 'tuple[]',
      components: [
        { name: 'address', type: 'address' },
        { name: 'chainId', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    { type: 'bytes32' },
  ]

  const encodedHex = AbiParameters.encode(abiSchema, [
    params.userAddress,
    params.nonce,
    originTokensForAbi,
    destinationTokensForAbi,
    cumulativeCallsHashHex,
  ]) as Hex.Hex

  const encodedBytes = Bytes.fromHex(encodedHex)
  const hashBytes = Hash.keccak256(encodedBytes)
  const hashHex = Bytes.toHex(hashBytes)

  return hashHex
}

// TODO: Add proper type
export function bigintReplacer(_key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value
}

export function getAnypayLifiInfoHash(lifiInfos: AnypayLifiInfo[], attestationAddress: Address.Address): Hex.Hex {
  if (!lifiInfos || lifiInfos.length === 0) {
    throw new Error('lifiInfos is empty')
  }
  if (!attestationAddress || attestationAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('attestationAddress is zero')
  }

  const anypayLifiInfoComponents = [
    { name: 'originToken', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'originChainId', type: 'uint256' },
    { name: 'destinationChainId', type: 'uint256' },
  ]

  const lifiInfosForAbi = lifiInfos.map((info) => ({
    originToken: info.originToken,
    amount: info.amount,
    originChainId: info.originChainId,
    destinationChainId: info.destinationChainId,
  }))

  const abiSchema = [
    {
      type: 'tuple[]',
      name: 'lifiInfos',
      components: anypayLifiInfoComponents,
    },
    { type: 'address', name: 'attestationAddress' },
  ]

  const encodedHex = AbiParameters.encode(abiSchema, [lifiInfosForAbi, attestationAddress]) as Hex.Hex
  const encodedBytes = Bytes.fromHex(encodedHex)
  const hashBytes = Hash.keccak256(encodedBytes)
  return Bytes.toHex(hashBytes)
}

export function calculateIntentConfigurationAddress(
  mainSigner: Address.Address,
  calls: IntentCallsPayload[],
  context: Context.Context,
  attestationSigner?: Address.Address,
  lifiInfos?: AnypayLifiInfo[],
): Address.Address {
  const config = createIntentConfiguration(mainSigner, calls, attestationSigner, lifiInfos)

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

function createIntentConfiguration(
  mainSigner: Address.Address,
  calls: IntentCallsPayload[],
  attestationSigner?: Address.Address,
  lifiInfos?: AnypayLifiInfo[],
): Config.Config {
  const mainSignerLeaf: Config.SignerLeaf = {
    type: 'signer',
    address: mainSigner,
    weight: 1n,
  }

  const subdigestLeaves: Config.AnyAddressSubdigestLeaf[] = calls.map((call) => {
    const digest = Payload.hash(Address.from('0x0000000000000000000000000000000000000000'), call.chainId, call)
    console.log('digest:', Bytes.toHex(digest))
    return {
      type: 'any-address-subdigest',
      digest: Bytes.toHex(digest),
    } as Config.AnyAddressSubdigestLeaf
  })

  const otherLeaves: Config.Topology[] = [...subdigestLeaves]

  if (lifiInfos && lifiInfos.length > 0) {
    if (attestationSigner) {
      const lifiConditionLeaf: Config.SapientSignerLeaf = {
        type: 'sapient-signer',
        // address: ANYPAY_LIFI_SAPIENT_SIGNER_ADDRESS,
        address: ANYPAY_LIFI_SAPIENT_SIGNER_LITE_ADDRESS,
        weight: 1n,
        imageHash: getAnypayLifiInfoHash(lifiInfos, attestationSigner),
      }
      otherLeaves.push(lifiConditionLeaf)
    }
  }

  if (otherLeaves.length === 0) {
    throw new Error('Intent configuration must have at least one call or LiFi information.')
  }

  let secondaryTopologyNode: Config.Topology

  if (otherLeaves.length === 1) {
    secondaryTopologyNode = otherLeaves[0]!
  } else {
    secondaryTopologyNode = buildMerkleTreeFromMembers(otherLeaves)
  }

  return {
    threshold: 1n,
    checkpoint: 0n,
    topology: [mainSignerLeaf, secondaryTopologyNode] as Config.Node,
  }
}

// Renamed and generalized from createSubdigestTree
function buildMerkleTreeFromMembers(members: Config.Topology[]): Config.Topology {
  if (members.length === 0) {
    throw new Error('Cannot create a tree from empty members')
  }
  if (members.length === 1) {
    return members[0]! // Returns a single Leaf or a Node
  }

  let currentLevel = [...members]
  while (currentLevel.length > 1) {
    const nextLevel: Config.Topology[] = []
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]!
      if (i + 1 < currentLevel.length) {
        const right = currentLevel[i + 1]!
        nextLevel.push([left, right] as Config.Node)
      } else {
        // Odd one out, carries over to the next level
        nextLevel.push(left)
      }
    }
    currentLevel = nextLevel
  }
  return currentLevel[0]!
}
