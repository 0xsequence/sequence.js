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
  const nonceBytesNeeded = minBytesFor(payload.nonce)
  if (nonceBytesNeeded > 15) {
    throw new Error('Nonce is too large')
  }

  /*
    globalFlag layout:
      bit 0: spaceZeroFlag => 1 if space == 0, else 0
      bits [1..3]: how many bytes we use to encode nonce
      bit 4: singleCallFlag => 1 if there's exactly one call
      bit 5: callsCountSizeFlag => 1 if #calls stored in 2 bytes, 0 if in 1 byte
      (bits [6..7] are unused/free)
  */
  let globalFlag = 0

  if (payload.space === 0n) {
    globalFlag |= 0x01
  }

  // bits [1..3] => how many bytes for the nonce
  globalFlag |= nonceBytesNeeded << 1

  // bit [4] => singleCallFlag
  if (callsLen === 1) {
    globalFlag |= 0x10
  }

  /*
    If there's more than one call, we decide if we store the #calls in 1 or 2 bytes.
    bit [5] => callsCountSizeFlag: 1 => 2 bytes, 0 => 1 byte
  */
  let callsCountSize = 0
  if (callsLen !== 1) {
    if (callsLen < 256) {
      callsCountSize = 1
    } else if (callsLen < 65536) {
      callsCountSize = 2
      globalFlag |= 0x20
    } else {
      throw new Error('Too many calls')
    }
  }

  // Start building the output
  // We'll accumulate in a Bytes object as we go
  let out = Bytes.fromNumber(globalFlag, { size: 1 })

  // If space isn't 0, store it as exactly 20 bytes (like uint160)
  if (payload.space !== 0n) {
    const spaceBytes = Bytes.padLeft(Bytes.fromNumber(payload.space), 20)
    out = Bytes.concat(out, spaceBytes)
  }

  // Encode nonce in nonceBytesNeeded
  if (nonceBytesNeeded > 0) {
    // We'll store nonce in exactly nonceBytesNeeded bytes
    const nonceBytes = Bytes.padLeft(Bytes.fromNumber(payload.nonce), nonceBytesNeeded)
    out = Bytes.concat(out, nonceBytes)
  }

  // Store callsLen if not single-call
  if (callsLen !== 1) {
    if (callsCountSize === 1) {
      out = Bytes.concat(out, Bytes.fromNumber(callsLen, { size: 1 }))
    } else {
      // callsCountSize === 2
      out = Bytes.concat(out, Bytes.fromNumber(callsLen, { size: 2 }))
    }
  }

  // Now encode each call
  for (const call of payload.calls) {
    /*
      call flags layout (1 byte):
        bit 0 => toSelf (call.to == this)
        bit 1 => hasValue (call.value != 0)
        bit 2 => hasData (call.data.length > 0)
        bit 3 => hasGasLimit (call.gasLimit != 0)
        bit 4 => delegateCall
        bit 5 => onlyFallback
        bits [6..7] => behaviorOnError => 0=ignore, 1=revert, 2=abort
    */
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
        throw new Error(`Unknown behaviorOnError: ${call.behaviorOnError}`)
    }
    flags |= behaviorBits << 6

    out = Bytes.concat(out, Bytes.fromNumber(flags, { size: 1 }))

    // If toSelf bit not set, store 20-byte address
    if ((flags & 0x01) === 0) {
      const addrBytes = Bytes.fromHex(call.to)
      if (addrBytes.length !== 20) {
        throw new Error(`Invalid 'to' address: ${call.to}`)
      }
      out = Bytes.concat(out, addrBytes)
    }

    // If hasValue, store 32 bytes of value
    if ((flags & 0x02) !== 0) {
      const valueBytes = Bytes.padLeft(Bytes.fromNumber(call.value), 32)
      out = Bytes.concat(out, valueBytes)
    }

    // If hasData, store 3 bytes of data length + data
    if ((flags & 0x04) !== 0) {
      const dataLen = call.data.length
      if (dataLen > 0xffffff) {
        throw new Error('Data too large')
      }
      // 3 bytes => up to 16,777,215
      const dataLenBytes = Bytes.fromNumber(dataLen, { size: 3 })
      out = Bytes.concat(out, dataLenBytes, call.data)
    }

    // If hasGasLimit, store 32 bytes of gasLimit
    if ((flags & 0x08) !== 0) {
      const gasBytes = Bytes.padLeft(Bytes.fromNumber(call.gasLimit), 32)
      out = Bytes.concat(out, gasBytes)
    }
  }

  return out
}
