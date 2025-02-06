import { Bytes } from 'ox'
import {
  encodeSessionPermissions,
  SessionPermissions,
  sessionPermissionsFromParsed,
  sessionPermissionsToJson,
} from './permission'
import { minBytesFor } from './utils'

export const SESSIONS_FLAG_PERMISSIONS = 0
export const SESSIONS_FLAG_NODE = 1
export const SESSIONS_FLAG_BRANCH = 2

export type SessionNode = Bytes.Bytes // Hashed
export type SessionLeaf = SessionPermissions
export type SessionBranch = [SessionsTopology, SessionsTopology, ...SessionsTopology[]]
export type SessionsTopology = SessionBranch | SessionLeaf | SessionNode

function isNode(topology: SessionsTopology): topology is SessionNode {
  return Bytes.validate(topology)
}

function isLeaf(topology: SessionsTopology): topology is SessionLeaf {
  return typeof topology === 'object' && 'signer' in topology
}

function isBranch(topology: SessionsTopology): topology is SessionBranch {
  return Array.isArray(topology) && topology.length === 2 && isTopology(topology[0]!) && isTopology(topology[1]!)
}

function isTopology(topology: SessionsTopology): topology is SessionsTopology {
  return isBranch(topology) || isLeaf(topology) || isNode(topology)
}

export function encodeSessionsTopology(topolgy: SessionsTopology): Bytes.Bytes {
  if (isBranch(topolgy)) {
    const branch = topolgy as SessionBranch
    const encodedBranches = []
    for (const node of branch) {
      encodedBranches.push(encodeSessionsTopology(node))
    }
    const encoded = Bytes.concat(...encodedBranches)
    let encodedSize = minBytesFor(BigInt(encoded.length))
    if (encodedSize > 15) throw new Error('Branch too large')
    const flagByte = (SESSIONS_FLAG_BRANCH << 4) | encodedSize
    return Bytes.concat(
      Bytes.fromNumber(flagByte),
      Bytes.padLeft(Bytes.fromNumber(encoded.length), encodedSize),
      encoded,
    )
  }

  if (isLeaf(topolgy)) {
    const encodedLeaf = encodeSessionPermissions(topolgy)
    return Bytes.concat(Bytes.fromNumber(SESSIONS_FLAG_PERMISSIONS), encodedLeaf)
  }

  if (isNode(topolgy)) {
    return Bytes.concat(Bytes.fromNumber(SESSIONS_FLAG_NODE), topolgy)
  }

  throw new Error('Invalid topology')
}

export function sessionsTopologyToJson(topology: SessionsTopology): string {
  if (isNode(topology)) {
    return Bytes.toHex(topology)
  }

  if (isLeaf(topology)) {
    return sessionPermissionsToJson(topology)
  }

  if (isBranch(topology)) {
    const branch = topology as SessionBranch
    return `[${branch.map((node) => sessionsTopologyToJson(node)).join(',')}]`
  }

  throw new Error('Invalid topology')
}

export function sessionsTopologyFromJson(json: string): SessionsTopology {
  const parsed = JSON.parse(json)
  return sessionsTopologyFromParsed(parsed)
}

function sessionsTopologyFromParsed(parsed: any): SessionsTopology {
  if (isNode(parsed)) {
    return parsed
  }

  if (isLeaf(parsed)) {
    return sessionPermissionsFromParsed(parsed)
  }

  if (isBranch(parsed)) {
    const branches = parsed.map((node: SessionsTopology) => sessionsTopologyFromParsed(node))
    return branches as SessionBranch
  }

  throw new Error('Invalid topology')
}
