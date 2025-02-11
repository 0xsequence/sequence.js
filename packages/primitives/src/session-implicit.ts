import { Bytes } from 'ox'
import { Attestation, encodeAttestation } from './attestation'
import { packRSV } from './utils'

/**
 * An implicit session configuration consists of a blacklist of addresses.
 */
export interface ImplicitSessionConfiguration {
  blacklist: string[]
}

export function emptyImplicitSessionConfiguration(): ImplicitSessionConfiguration {
  return { blacklist: [] }
}

/**
 * Adds an address to the implicit session's blacklist.
 * If the address is not already in the blacklist, it is added and the list is sorted.
 */
export function addToImplicitSessionBlacklist(
  sessionConfiguration: ImplicitSessionConfiguration,
  address: string,
): ImplicitSessionConfiguration {
  const { blacklist } = sessionConfiguration
  if (!blacklist.some((addr) => addr === address)) {
    blacklist.push(address)
    blacklist.sort() // keep sorted so on-chain binary search works as expected
  }
  return { ...sessionConfiguration, blacklist }
}

/**
 * Removes an address from the implicit session's blacklist.
 */
export function removeFromImplicitSessionBlacklist(
  sessionConfiguration: ImplicitSessionConfiguration,
  address: string,
): ImplicitSessionConfiguration {
  const blacklist = sessionConfiguration.blacklist.filter((a) => a !== address)
  return { ...sessionConfiguration, blacklist }
}

/**
 * Encodes the implicit session signature.
 *
 * The on‐chain encoding layout is:
 *   [sessionSignature (64 bytes)] ++ [attestation] ++ [globalSignature (64 bytes)]
 *   ++ [uint24(blacklist.length)] ++ [blacklist addresses (each 20 bytes)]
 *
 * The provided session and global signatures (as {r, s, v} objects) are first
 * packed into a compact 64-byte representation via packRSV.
 *
 * @param sessionSig - The session signature (r, s, v) object.
 * @param attestation - The packed attestation bytes.
 * @param globalSig - The global signature (r, s, v) object.
 * @param blacklist - The array of blacklisted addresses (as hex strings).
 * @returns The fully encoded implicit session signature as a Uint8Array.
 */
export function encodeImplicitSessionSignature(
  sessionSig: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
  attestation: Attestation,
  globalSig: { v: number; r: Bytes.Bytes; s: Bytes.Bytes },
  sessionConfiguration: ImplicitSessionConfiguration,
): Uint8Array {
  // Pack the session and global signatures into their compact 64-byte representations.
  const sessionSigPacked = packRSV(sessionSig)
  const globalSigPacked = packRSV(globalSig)

  // Blacklist encoding
  const { blacklist } = sessionConfiguration
  const blacklistBytes = blacklist.map((addr) => Bytes.fromHex(addr as `0x${string}`))
  const concatenatedBlacklist = blacklistBytes.length > 0 ? Bytes.concat(...blacklistBytes) : new Uint8Array(0)
  const blacklistLengthBytes = Bytes.fromNumber(blacklist.length, { size: 3 })

  // Concatenate all parts in order.
  return Bytes.concat(
    sessionSigPacked,
    encodeAttestation(attestation),
    globalSigPacked,
    blacklistLengthBytes,
    concatenatedBlacklist,
  )
}
