import { ethers } from 'ethers'

import { deployV1Context } from './v1'
import { deployV2Context } from './v2'
import { commons } from '@0xsequence/core'

export async function deploySequenceContexts(signer: ethers.Signer): Promise<commons.context.VersionedContext> {
  const { chainId } = await signer.provider!.getNetwork()

  console.time(`[${chainId}] [v1]: Finished in`)
  const v1 = await deployV1Context(signer)
  console.timeEnd(`[${chainId}] [v1]: Finished in`)

  console.time(`[${chainId}] [v2]: Finished in`)
  const v2 = await deployV2Context(signer)
  console.timeEnd(`[${chainId}] [v2]: Finished in`)

  return { 1: v1, 2: v2 }
}

export * as v1 from './v1'
export * as v2 from './v2'
