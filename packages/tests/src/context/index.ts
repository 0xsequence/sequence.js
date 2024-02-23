import { ethers } from 'ethers'

import { deployV1Context } from './v1'
import { deployV2Context } from './v2'
import { VersionedContext } from '@0xsequence/core/src/commons/context'

export async function deploySequenceContexts(signer: ethers.Signer): Promise<VersionedContext> {
  const v1 = await deployV1Context(signer)
  const v2 = await deployV2Context(signer)
  return { 1: v1, 2: v2 }
}

export * as v1 from './v1'
export * as v2 from './v2'
