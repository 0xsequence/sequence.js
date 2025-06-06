import { IntentPrecondition } from '@0xsequence/api'
import { Relayer } from '@0xsequence/wallet-core'
import { Hex } from 'viem'
import { MetaTxn } from './metaTxnMonitor.js'

export async function relayerSendMetaTx(
  relayer: Relayer.Rpc.RpcRelayer,
  metaTx: MetaTxn,
  preconditions: IntentPrecondition[],
): Promise<Hex> {
  const { opHash } = await relayer.sendMetaTxn(
    metaTx.walletAddress as `0x${string}`,
    metaTx.contract as `0x${string}`,
    metaTx.input as Hex,
    BigInt(metaTx.chainId),
    undefined,
    preconditions,
  )

  return opHash
}
