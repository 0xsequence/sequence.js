import { SequenceAPIClient } from './apiClient'
import { IntentCallsPayload, AnypayLifiInfo, IntentPrecondition, GetIntentCallsPayloadsArgs } from '@0xsequence/api'
import { AnyPay } from '@0xsequence/wallet-core'
import { Context as ContextLike } from '@0xsequence/wallet-primitives'
import { Address, Bytes } from 'ox'
import { Hex, isAddressEqual, WalletClient, PrivateKeyAccount } from 'viem'
import { findPreconditionAddress } from './preconditions'

export type OriginCallParams = {
  to: `0x${string}` | null
  data: Hex | null
  value: bigint | null
  chainId: number | null
  error?: string
}

export async function getIntentCallsPayloads(apiClient: SequenceAPIClient, args: GetIntentCallsPayloadsArgs) {
  return apiClient.getIntentCallsPayloads(args)
}

export function calculateIntentAddress(
  mainSigner: string,
  calls: IntentCallsPayload[],
  lifiInfosArg: AnypayLifiInfo[] | null | undefined,
) {
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
      data: Bytes.toHex(Bytes.from((call.data as Hex) || '0x')),
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

  const calculatedAddress = AnyPay.calculateIntentConfigurationAddress(
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
) {
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
  return apiClient.commitIntentConfig(args)
}

export async function sendOriginTransaction(
  wallet: PrivateKeyAccount,
  client: WalletClient,
  originParams: any,
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
