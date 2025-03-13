import { AbiFunction, AbiParameters, Address, Bytes, Hash, Hex, TypedData } from 'ox'
import { RECOVER_SAPIENT_SIGNATURE } from './constants'
import { minBytesFor } from './utils'
import { getSignPayload } from 'ox/TypedData'

export type Call = {
  to: Address.Address
  value: bigint
  data: Bytes.Bytes
  gasLimit: bigint
  delegateCall: boolean
  onlyFallback: boolean
  behaviorOnError: 'ignore' | 'revert' | 'abort'
}

export type Calls = {
  type: 'call'
  space: bigint
  nonce: bigint
  calls: Call[]
}

export type Message = {
  type: 'message'
  message: Bytes.Bytes
}

export type ConfigUpdate = {
  type: 'config-update'
  imageHash: Hex.Hex
}

export type Digest = {
  type: 'digest'
  digest: Hex.Hex
}

export type Parent = {
  parentWallets?: Address.Address[]
}

export type Payload = Calls | Message | ConfigUpdate | Digest

export type Parented = Payload & Parent

export type TypedDataToSign = {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: Address.Address
  }
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, unknown>
}

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

export function isCalls(payload: Payload): payload is Calls {
  return payload.type === 'call'
}

export function isMessage(payload: Payload): payload is Message {
  return payload.type === 'message'
}

export function isConfigUpdate(payload: Payload): payload is ConfigUpdate {
  return payload.type === 'config-update'
}

export function encode(payload: Calls, self?: Address.Address): Bytes.Bytes {
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

    flags |= encodeBehaviorOnError(call.behaviorOnError) << 6

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

export function encodeSapient(
  chainId: bigint,
  payload: Parented,
): Exclude<AbiFunction.encodeData.Args<typeof RECOVER_SAPIENT_SIGNATURE>[0], undefined>[0] {
  const encoded: ReturnType<typeof encodeSapient> = {
    kind: 0,
    noChainId: !chainId,
    calls: [],
    space: 0n,
    nonce: 0n,
    message: '0x',
    imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    digest: '0x0000000000000000000000000000000000000000000000000000000000000000',
    parentWallets: payload.parentWallets ?? [],
  }

  switch (payload.type) {
    case 'call':
      encoded.kind = 0
      encoded.calls = payload.calls.map((call) => ({
        ...call,
        data: Bytes.toHex(call.data),
        behaviorOnError: BigInt(encodeBehaviorOnError(call.behaviorOnError)),
      }))
      encoded.space = payload.space
      encoded.nonce = payload.nonce
      break

    case 'message':
      encoded.kind = 1
      encoded.message = Bytes.toHex(payload.message)
      break

    case 'config-update':
      encoded.kind = 2
      encoded.imageHash = payload.imageHash
      break

    case 'digest':
      encoded.kind = 3
      encoded.digest = payload.digest
      break
  }

  return encoded
}

export function hash(wallet: Address.Address, chainId: bigint, payload: Parented): Bytes.Bytes {
  const typedData = toTyped(wallet, chainId, payload)
  return Bytes.fromHex(getSignPayload(typedData))
}

export function toTyped(wallet: Address.Address, chainId: bigint, payload: Parented): TypedDataToSign {
  const domain = {
    name: 'Sequence Wallet',
    version: '3',
    chainId: Number(chainId),
    verifyingContract: wallet,
  }

  switch (payload.type) {
    case 'call': {
      // This matches the EIP712 structure used in our hash() function
      const types = {
        Calls: [
          { name: 'calls', type: 'Call[]' },
          { name: 'space', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'wallets', type: 'address[]' },
        ],
        Call: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          { name: 'gasLimit', type: 'uint256' },
          { name: 'delegateCall', type: 'bool' },
          { name: 'onlyFallback', type: 'bool' },
          { name: 'behaviorOnError', type: 'uint256' },
        ],
      }

      // We ensure 'behaviorOnError' is turned into a numeric value
      const message = {
        calls: payload.calls.map((call) => ({
          to: call.to,
          value: call.value.toString(),
          data: Bytes.toHex(call.data),
          gasLimit: call.gasLimit.toString(),
          delegateCall: call.delegateCall,
          onlyFallback: call.onlyFallback,
          behaviorOnError: BigInt(encodeBehaviorOnError(call.behaviorOnError)).toString(),
        })),
        space: payload.space.toString(),
        nonce: payload.nonce.toString(),
        wallets: payload.parentWallets ?? [],
      }

      return {
        domain,
        types,
        primaryType: 'Calls',
        message,
      }
    }

    case 'message': {
      const types = {
        Message: [
          { name: 'message', type: 'bytes' },
          { name: 'wallets', type: 'address[]' },
        ],
      }

      const message = {
        message: Bytes.toHex(payload.message),
        wallets: payload.parentWallets ?? [],
      }

      return {
        domain,
        types,
        primaryType: 'Message',
        message,
      }
    }

    case 'config-update': {
      const types = {
        ConfigUpdate: [
          { name: 'imageHash', type: 'bytes32' },
          { name: 'wallets', type: 'address[]' },
        ],
      }

      const message = {
        imageHash: payload.imageHash,
        wallets: payload.parentWallets ?? [],
      }

      return {
        domain,
        types,
        primaryType: 'ConfigUpdate',
        message,
      }
    }

    case 'digest': {
      const types = {
        Digest: [
          { name: 'digest', type: 'bytes32' },
          { name: 'wallets', type: 'address[]' },
        ],
      }

      const message = {
        digest: payload.digest,
        wallets: payload.parentWallets ?? [],
      }

      return {
        domain,
        types,
        primaryType: 'Digest',
        message,
      }
    }
  }
}

export function encodeBehaviorOnError(behaviorOnError: Call['behaviorOnError']): number {
  switch (behaviorOnError) {
    case 'ignore':
      return 0
    case 'revert':
      return 1
    case 'abort':
      return 2
  }
}

export function hashCall(call: Call): Hex.Hex {
  const CALL_TYPEHASH = Hash.keccak256(
    Bytes.fromString(
      'Call(address to,uint256 value,bytes data,uint256 gasLimit,bool delegateCall,bool onlyFallback,uint256 behaviorOnError)',
    ),
  )

  return Hash.keccak256(
    AbiParameters.encode(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bool' },
        { type: 'bool' },
        { type: 'uint256' },
      ],
      [
        Hex.from(CALL_TYPEHASH),
        Hex.from(call.to),
        call.value,
        Hex.from(Hash.keccak256(call.data)),
        call.gasLimit,
        call.delegateCall,
        call.onlyFallback,
        BigInt(encodeBehaviorOnError(call.behaviorOnError)),
      ],
    ),
  )
}
