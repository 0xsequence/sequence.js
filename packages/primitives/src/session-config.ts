import { Bytes } from 'ox'
import { encodeSessionPermissions, SessionPermissions } from './permission'
import { minBytesFor } from './utils'

export const FLAG_PERMISSIONS = 0
export const FLAG_NODE = 1
export const FLAG_BRANCH = 2

export type SessionLeaf = SessionPermissions
export type SessionNode = [SessionsTopology, SessionsTopology]
export type SessionsTopology = SessionNode | SessionLeaf

function isLeaf(topology: SessionsTopology): topology is SessionLeaf {
  return typeof topology === 'object' && 'signer' in topology
}

function isNode(topology: SessionsTopology): topology is SessionNode {
  return Array.isArray(topology) && topology.length === 2 && isTopology(topology[0]!) && isTopology(topology[1]!)
}

function isTopology(topology: SessionsTopology): topology is SessionsTopology {
  return isNode(topology) || isLeaf(topology)
}

export function encodeSessionsTopology(topolgy: SessionsTopology): Bytes.Bytes {
  if (isNode(topolgy)) {
    const encoded0 = encodeSessionsTopology(topolgy[0]!)
    const encoded1 = encodeSessionsTopology(topolgy[1]!)
    const isBranching = isNode(topolgy[1]!)

    if (isBranching) {
      const encoded1Size = minBytesFor(BigInt(encoded1.length))
      if (encoded1Size > 15) {
        throw new Error('Branch too large')
      }

      const flag = (FLAG_BRANCH << 4) | encoded1Size
      return Bytes.concat(
        encoded0,
        Bytes.fromNumber(flag),
        Bytes.padLeft(Bytes.fromNumber(encoded1.length), encoded1Size),
        encoded1,
      )
    }

    return Bytes.concat(Bytes.fromNumber(FLAG_NODE), encoded0, encoded1)
  }

  if (isLeaf(topolgy)) {
    const encodedLeaf = encodeSessionPermissions(topolgy)
    return Bytes.concat(Bytes.fromNumber(FLAG_PERMISSIONS), encodedLeaf)
  }

  throw new Error('Invalid topology')
}
