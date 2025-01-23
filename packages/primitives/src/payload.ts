import { Address, Bytes, Hex } from 'ox'
import { minBytesFor } from './utils'

export type Call = {
  to: Address.Address
  value: bigint
  data: Bytes.Bytes
  gasLimit: bigint
  delegateCall: boolean
  onlyFallback: boolean
  behaviorOnError: 'ignore' | 'revert' | 'abort'
}

export type CallPayload = {
  type: 'call'
  space: bigint
  nonce: bigint
  calls: Call[]
}

export type MessagePayload = {
  type: 'message'
  message: Bytes.Bytes
}

export type ConfigUpdatePayload = {
  type: 'config-update'
  imageHash: Hex.Hex
}

export type DigestPayload = {
  type: 'digest'
  digest: Hex.Hex
}

export type ParentPayload = {
  parentWallets?: Address.Address[]
}

export type Payload = CallPayload | MessagePayload | ConfigUpdatePayload | DigestPayload

export type ParentedPayload = Payload & ParentPayload

export function fromMessage(message: Bytes.Bytes): Payload {
  return {
    type: 'message',
    message,
  }
}

export function fromConfigUpdate(imageHash: Hex.Hex): Payload {
  return {
    type: 'config-update',
    imageHash,
  }
}

export function fromDigest(digest: Hex.Hex): Payload {
  return {
    type: 'digest',
    digest,
  }
}

export function fromCall(nonce: bigint, space: bigint, calls: Call[]): Payload {
  return {
    type: 'call',
    nonce,
    space,
    calls,
  }
}

export function encode(payload: CallPayload, self?: Address.Address): Bytes.Bytes {
  const callsLen = payload.calls.length
  const minBytes = minBytesFor(payload.nonce)
  if (minBytes > 15) {
    throw new Error('Nonce is too large')
  }

  /*
    globalFlag layout:

      bit 1: spaceZeroFlag => 1 if space == 0, else 0
      bits [2..4]: nonceBytes => how many bytes we use to encode nonce
      bit 5: singleCallFlag => 1 if there's exactly one call, else 0
      bit 6: callsCountSizeFlag => 1 if #calls stored in 1 byte, else 0 if stored in 2 bytes

      (bits 7..7 are unused, or free)
  */
  let globalFlag = 0
  if (payload.space === 0n) {
    globalFlag |= 0x01
  }
  globalFlag |= minBytes << 1
  if (callsLen === 1) {
    globalFlag |= 0x10
  }

  // If more than one call, figure out if we store the calls count in 1 or 2 bytes
  let callsCountSize = 0
  if (callsLen !== 1) {
    if (callsLen < 256) {
      callsCountSize = 1
    } else {
      globalFlag |= 0x20
      callsCountSize = 2
    }
  }

  const out: number[] = []
  out.push(globalFlag)

  // If space isn't zero, we store it in 20 bytes (uint160)
  if (payload.space !== 0n) {
    const spaceHex = payload.space.toString(16).padStart(40, '0')
    for (let i = 0; i < 20; i++) {
      out.push(parseInt(spaceHex.substring(i * 2, i * 2 + 2), 16))
    }
  }

  // Encode nonce in minBytes
  if (minBytes > 0) {
    let nonceHex = payload.nonce.toString(16)
    nonceHex = nonceHex.padStart(minBytes * 2, '0')
    for (let i = 0; i < minBytes; i++) {
      out.push(parseInt(nonceHex.substring(i * 2, i * 2 + 2), 16))
    }
  }

  // Store the calls length if not single-call
  if (callsLen !== 1) {
    if (callsCountSize === 1) {
      out.push(callsLen & 0xff)
    } else {
      out.push((callsLen >> 8) & 0xff, callsLen & 0xff)
    }
  }

  /*
    Each call has a flags byte:

      bit 0: toSelf => 1 if call.to == address(this) in solidity, else 0
      bit 1: hasValue => 1 if call.value != 0
      bit 2: hasData => 1 if call.data.length > 0
      bit 3: hasGasLimit => 1 if call.gasLimit != 0
      bit 4: delegateCall
      bit 5: onlyFallback
      bits [6..7]: behaviorOnError => 0=ignore, 1=revert, 2=abort
  */

  for (const call of payload.calls) {
    let flags = 0

    if (self && call.to === self) {
      flags |= 0x01
    }

    if (call.value !== 0n) {
      flags |= 0x02
    }

    if (call.data && call.data.length > 0) {
      flags |= 0x04
    }

    if (call.gasLimit !== 0n) {
      flags |= 0x08
    }

    if (call.delegateCall) {
      flags |= 0x10
    }

    if (call.onlyFallback) {
      flags |= 0x20
    }

    // bits [6..7] => behaviorOnError
    let behaviorBits = 0
    switch (call.behaviorOnError) {
      case 'ignore':
        behaviorBits = 0
        break
      case 'revert':
        behaviorBits = 1
        break
      case 'abort':
        behaviorBits = 2
        break
      default:
        throw new Error(`Unknown behavior: ${call.behaviorOnError}`)
    }
    flags |= behaviorBits << 6

    out.push(flags)

    // If bit0 is 0, we store the address in 20 bytes
    if ((flags & 0x01) === 0) {
      const addr = call.to.startsWith('0x') ? call.to.substring(2) : call.to
      if (addr.length !== 40) {
        throw new Error(`Invalid 'to' address: ${call.to}`)
      }
      for (let i = 0; i < 20; i++) {
        out.push(parseInt(addr.substring(i * 2, i * 2 + 2), 16))
      }
    }

    // If bit1 is set, store 32 bytes of value
    if ((flags & 0x02) !== 0) {
      const valHex = call.value.toString(16).padStart(64, '0')
      for (let i = 0; i < 32; i++) {
        out.push(parseInt(valHex.substring(i * 2, i * 2 + 2), 16))
      }
    }

    // If bit2 is set, store 3 bytes of data length + data
    if ((flags & 0x04) !== 0) {
      const dataLen = call.data.length
      if (dataLen > 0xffffff) {
        throw new Error('Data too large')
      }
      out.push((dataLen >> 16) & 0xff, (dataLen >> 8) & 0xff, dataLen & 0xff)
      out.push(...call.data)
    }

    // If bit3 is set, store 32 bytes of gasLimit
    if ((flags & 0x08) !== 0) {
      const gasHex = call.gasLimit.toString(16).padStart(64, '0')
      for (let i = 0; i < 32; i++) {
        out.push(parseInt(gasHex.substring(i * 2, i * 2 + 2), 16))
      }
    }
  }

  return Bytes.from(out)
}
