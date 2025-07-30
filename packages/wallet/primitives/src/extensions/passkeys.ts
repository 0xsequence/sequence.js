import { Bytes, Hex, WebAuthnP256 } from 'ox'
import * as GenericTree from '../generic-tree.js'

export type PasskeyMetadata = {
  credentialId: string
}

export type PublicKey = {
  requireUserVerification: boolean
  x: Hex.Hex
  y: Hex.Hex
  metadata?: PasskeyMetadata | Hex.Hex
}

export function metadataTree(metadata: Required<PublicKey>['metadata']): GenericTree.Tree {
  if (typeof metadata === 'object') {
    return {
      type: 'leaf',
      value: Bytes.fromString(metadata.credentialId),
    }
  } else {
    return metadata
  }
}

export function metadataNode(metadata: Required<PublicKey>['metadata']): GenericTree.Node {
  return GenericTree.hash(metadataTree(metadata))
}

export function toTree(publicKey: PublicKey): GenericTree.Tree {
  const a = Hex.padLeft(publicKey.x, 32)
  const b = Hex.padLeft(publicKey.y, 32)
  const c = Hex.padLeft(publicKey.requireUserVerification ? '0x01' : '0x00', 32)

  if (publicKey.metadata) {
    return [
      [a, b],
      [c, metadataTree(publicKey.metadata)],
    ]
  } else {
    return [
      [a, b],
      [c, Hex.padLeft('0x00', 32)],
    ]
  }
}

export function fromTree(tree: GenericTree.Tree): PublicKey {
  if (!GenericTree.isBranch(tree) || tree.length !== 2) {
    throw new Error('Invalid tree')
  }
  const [p1, p2] = tree
  if (!GenericTree.isBranch(p1) || p1.length !== 2) {
    throw new Error('Invalid tree for x,y')
  }

  const [x, y] = p1
  if (!GenericTree.isNode(x)) {
    throw new Error('Invalid x bytes')
  }
  if (!GenericTree.isNode(y)) {
    throw new Error('Invalid y bytes')
  }

  let requireUserVerification = false
  let metadata: PublicKey['metadata']

  if (GenericTree.isBranch(p2)) {
    if (p2.length !== 2) {
      throw new Error('Invalid tree for c,metadata')
    }

    const [c, meta] = p2
    if (!GenericTree.isNode(c)) {
      throw new Error('Invalid c bytes')
    }
    const cBytes = Hex.toBytes(c)
    requireUserVerification = cBytes[31] === 1

    if (GenericTree.isBranch(meta)) {
      if (meta.length !== 2) {
        throw new Error('Invalid metadata tree')
      }

      const [credLeaf, sub] = meta
      if (!GenericTree.isLeaf(credLeaf)) {
        throw new Error('Invalid credentialId leaf')
      }
      const credentialId = new TextDecoder().decode(credLeaf.value)

      if (!GenericTree.isBranch(sub) || sub.length !== 2) {
        throw new Error('Invalid sub-branch for name and createdAt')
      }

      const [nameLeaf, createdAtLeaf] = sub
      if (!GenericTree.isLeaf(nameLeaf) || !GenericTree.isLeaf(createdAtLeaf)) {
        throw new Error('Invalid metadata leaves')
      }

      metadata = { credentialId }
    } else if (GenericTree.isNode(meta)) {
      metadata = meta
    } else {
      throw new Error('Invalid metadata node')
    }
  } else {
    if (!GenericTree.isNode(p2)) {
      throw new Error('Invalid c bytes')
    }
    const p2Bytes = Hex.toBytes(p2)
    requireUserVerification = p2Bytes[31] === 1
  }

  return { requireUserVerification, x, y, metadata }
}

export function rootFor(publicKey: PublicKey): Hex.Hex {
  return GenericTree.hash(toTree(publicKey))
}

export type DecodedSignature = {
  publicKey: PublicKey
  r: Bytes.Bytes
  s: Bytes.Bytes
  authenticatorData: Bytes.Bytes
  clientDataJSON: string
  embedMetadata?: boolean
}

export function encode(decoded: DecodedSignature): Bytes.Bytes {
  const challengeIndex = decoded.clientDataJSON.indexOf('"challenge"')
  const typeIndex = decoded.clientDataJSON.indexOf('"type"')

  const authDataSize = decoded.authenticatorData.length
  const clientDataJSONSize = decoded.clientDataJSON.length

  if (authDataSize > 65535) {
    throw new Error('Authenticator data size is too large')
  }
  if (clientDataJSONSize > 65535) {
    throw new Error('Client data JSON size is too large')
  }

  const bytesAuthDataSize = authDataSize <= 255 ? 1 : 2
  const bytesClientDataJSONSize = clientDataJSONSize <= 255 ? 1 : 2
  const bytesChallengeIndex = challengeIndex <= 255 ? 1 : 2
  const bytesTypeIndex = typeIndex <= 255 ? 1 : 2

  let flags = 0

  flags |= decoded.publicKey.requireUserVerification ? 1 : 0 // 0x01 bit
  flags |= (bytesAuthDataSize - 1) << 1 // 0x02 bit
  flags |= (bytesClientDataJSONSize - 1) << 2 // 0x04 bit
  flags |= (bytesChallengeIndex - 1) << 3 // 0x08 bit
  flags |= (bytesTypeIndex - 1) << 4 // 0x10 bit

  // Set metadata flag if metadata exists
  if (decoded.embedMetadata) {
    flags |= 1 << 6 // 0x40 bit
  }

  let result: Bytes.Bytes = Bytes.from([flags])

  // Add metadata if it exists
  if (decoded.embedMetadata) {
    if (!decoded.publicKey.metadata) {
      throw new Error('Metadata is not present in the public key')
    }
    result = Bytes.concat(result, Hex.toBytes(metadataNode(decoded.publicKey.metadata)))
  }

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(authDataSize), bytesAuthDataSize))
  result = Bytes.concat(result, decoded.authenticatorData)

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(decoded.clientDataJSON.length), bytesClientDataJSONSize))
  result = Bytes.concat(result, Bytes.from(new TextEncoder().encode(decoded.clientDataJSON)))

  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(challengeIndex), bytesChallengeIndex))
  result = Bytes.concat(result, Bytes.padLeft(Bytes.fromNumber(typeIndex), bytesTypeIndex))

  result = Bytes.concat(result, Bytes.padLeft(decoded.r, 32))
  result = Bytes.concat(result, Bytes.padLeft(decoded.s, 32))

  result = Bytes.concat(result, Bytes.fromHex(decoded.publicKey.x))
  result = Bytes.concat(result, Bytes.fromHex(decoded.publicKey.y))

  return result
}

export function isValidSignature(challenge: Hex.Hex, decoded: DecodedSignature): boolean {
  return WebAuthnP256.verify({
    challenge,
    publicKey: {
      x: Hex.toBigInt(decoded.publicKey.x),
      y: Hex.toBigInt(decoded.publicKey.y),
      prefix: 4,
    },
    metadata: {
      authenticatorData: Hex.fromBytes(decoded.authenticatorData),
      challengeIndex: decoded.clientDataJSON.indexOf('"challenge"'),
      clientDataJSON: decoded.clientDataJSON,
      typeIndex: decoded.clientDataJSON.indexOf('"type"'),
      userVerificationRequired: decoded.publicKey.requireUserVerification,
    },
    signature: {
      r: Bytes.toBigInt(decoded.r),
      s: Bytes.toBigInt(decoded.s),
    },
  })
}

export function decode(data: Bytes.Bytes): Required<DecodedSignature> & { challengeIndex: number; typeIndex: number } {
  let offset = 0

  const flags = data[0]
  offset += 1

  if (flags === undefined) {
    throw new Error('Invalid flags')
  }

  const requireUserVerification = (flags & 0x01) !== 0x00
  const bytesAuthDataSize = ((flags >> 1) & 0x01) + 1
  const bytesClientDataJSONSize = ((flags >> 2) & 0x01) + 1
  const bytesChallengeIndex = ((flags >> 3) & 0x01) + 1
  const bytesTypeIndex = ((flags >> 4) & 0x01) + 1
  const hasMetadata = ((flags >> 6) & 0x01) === 0x01

  // Check if fallback to abi decode is needed
  if ((flags & 0x20) !== 0) {
    throw new Error('Fallback to abi decode is not supported in this implementation')
  }

  let metadata: Hex.Hex | undefined

  // Read metadata if present
  if (hasMetadata) {
    const metadataBytes = Bytes.slice(data, offset, offset + 32)
    metadata = Hex.fromBytes(metadataBytes)
    offset += 32
  }

  const authDataSize = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesAuthDataSize))
  offset += bytesAuthDataSize
  const authenticatorData = Bytes.slice(data, offset, offset + authDataSize)
  offset += authDataSize

  const clientDataJSONSize = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesClientDataJSONSize))
  offset += bytesClientDataJSONSize
  const clientDataJSONBytes = Bytes.slice(data, offset, offset + clientDataJSONSize)
  offset += clientDataJSONSize
  const clientDataJSON = new TextDecoder().decode(clientDataJSONBytes)

  const challengeIndex = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesChallengeIndex))
  offset += bytesChallengeIndex
  const typeIndex = Bytes.toNumber(Bytes.slice(data, offset, offset + bytesTypeIndex))
  offset += bytesTypeIndex

  const r = Bytes.slice(data, offset, offset + 32)
  offset += 32
  const s = Bytes.slice(data, offset, offset + 32)
  offset += 32

  const xBytes = Bytes.slice(data, offset, offset + 32)
  offset += 32
  const yBytes = Bytes.slice(data, offset, offset + 32)

  return {
    publicKey: {
      requireUserVerification,
      x: Hex.fromBytes(xBytes),
      y: Hex.fromBytes(yBytes),
      metadata,
    },
    r,
    s,
    authenticatorData,
    clientDataJSON,
    challengeIndex,
    typeIndex,
    embedMetadata: hasMetadata,
  }
}
