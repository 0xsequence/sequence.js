import { AbiFunction, Address, Bytes } from 'ox'
import { describe, expect, it } from 'vitest'

import { Permission } from '../../../../primitives/src/index.js'
import { Utils } from '../../../src/index.js'
import { Constants } from '@0xsequence/wallet-primitives'

const { PermissionBuilder } = Utils

const TARGET = Address.from('0x1234567890123456789012345678901234567890')
const TARGET2 = Address.from('0x1234567890123456789012345678901234567891')
const UINT256_VALUE = 1000000000000000000n
const BYTES32_MAX = Bytes.fromHex('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
const STRING_VALUE =
  'Chur bro, pack your togs and sunnies, we are heading to Taupo hot pools for a mean soak and a yarn, keen as'

describe('PermissionBuilder', () => {
  it('should build an unrestricted permission', () => {
    expect(() => PermissionBuilder.for(TARGET).build()).toThrow() // Call allowAll() first

    const permission = PermissionBuilder.for(TARGET).allowAll().build()
    expect(permission).toEqual({
      target: TARGET,
      rules: [],
    })
  })

  it('should build an exact match permission', () => {
    for (let i = 0; i < 10; i++) {
      const calldata = Bytes.random(Math.floor(Math.random() * 100)) // Random calldata
      console.log('random calldata', Bytes.toHex(calldata))
      const permission = PermissionBuilder.for(TARGET).exactCalldata(calldata).build()
      for (let i = 0; i < permission.rules.length; i++) {
        const rule = permission.rules[i]
        expect(rule.cumulative).toEqual(false)
        expect(rule.operation).toEqual(Permission.ParameterOperation.EQUAL)
        expect(rule.offset).toEqual(BigInt(i * 32))
        if (i < permission.rules.length - 1) {
          // Don't check the last rule as the mask may be different
          expect(rule.mask).toEqual(Permission.MASK.BYTES32)
          expect(rule.value).toEqual(calldata.slice(i * 32, (i + 1) * 32))
        }
      }
      // We should be able to decode the calldata from the rules
      const decoded = Bytes.concat(...permission.rules.map((r) => r.value.map((b, i) => b & r.mask[i]!)))
      expect(decoded).toEqual(Bytes.padRight(calldata, permission.rules.length * 32))
    }
  })

  it('should build a permission for transfer', () => {
    const permission = PermissionBuilder.for(TARGET).forFunction('transfer(address to, uint256 value)').build()
    expect(permission).toEqual({
      target: TARGET,
      rules: [
        {
          cumulative: false,
          operation: Permission.ParameterOperation.EQUAL,
          value: Bytes.padRight(Bytes.fromHex('0xa9059cbb'), 32),
          offset: 0n,
          mask: Permission.MASK.SELECTOR,
        },
      ],
    })
  })

  it('should build a permission for transfer only allowed once', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('transfer(address to, uint256 value)')
      .onlyOnce()
      .build()
    expect(permission).toEqual({
      target: TARGET,
      rules: [
        {
          cumulative: true,
          operation: Permission.ParameterOperation.EQUAL,
          value: Bytes.padRight(Bytes.fromHex('0xa9059cbb'), 32),
          offset: 0n,
          mask: Permission.MASK.SELECTOR,
        },
      ],
    })
  })

  it('should build a permission for transfer with a uint256 param', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('transfer(address to, uint256 value)')
      .withUintNParam('value', UINT256_VALUE, 256, Permission.ParameterOperation.LESS_THAN_OR_EQUAL)
      .build()
    // Check
    expect(permission).toEqual({
      target: TARGET,
      rules: [
        {
          cumulative: false,
          operation: Permission.ParameterOperation.EQUAL,
          value: Bytes.padRight(Bytes.fromHex('0xa9059cbb'), 32),
          offset: 0n,
          mask: Permission.MASK.SELECTOR,
        },
        {
          cumulative: false,
          operation: Permission.ParameterOperation.LESS_THAN_OR_EQUAL,
          value: Bytes.fromNumber(UINT256_VALUE, { size: 32 }),
          offset: 4n + 32n,
          mask: Permission.MASK.UINT256,
        },
      ],
    })
    // Check the offset matches the encoding by ox
    const abi = AbiFunction.from('function transfer(address to, uint256 value)')
    const encodedData = AbiFunction.encodeData(abi, [Constants.ZeroAddress, Bytes.toBigInt(BYTES32_MAX)])
    const encodedDataBytes = Bytes.fromHex(encodedData)
    const maskedHex = encodedDataBytes
      .slice(Number(permission.rules[1].offset), Number(permission.rules[1].offset) + 32)
      .map((b, i) => b & permission.rules[1].mask[i]!)
    expect(maskedHex).toEqual(BYTES32_MAX)
  })

  it('should build a permission for transfer with an address param', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('transfer(address to, uint256 value)')
      .withAddressParam('to', TARGET2)
      .build()
    // Check
    expect(permission).toEqual({
      target: TARGET,
      rules: [
        {
          cumulative: false,
          operation: Permission.ParameterOperation.EQUAL,
          value: Bytes.padRight(Bytes.fromHex('0xa9059cbb'), 32),
          offset: 0n,
          mask: Permission.MASK.SELECTOR,
        },
        {
          cumulative: false,
          operation: Permission.ParameterOperation.EQUAL,
          value: Bytes.concat(Bytes.fromHex('0x000000000000000000000000'), Bytes.fromHex(TARGET2)),
          offset: 4n,
          mask: Permission.MASK.ADDRESS,
        },
      ],
    })
    // Check the offset matches the encoding by ox
    const abi = AbiFunction.from('function transfer(address to, uint256 value)')
    const encodedData = AbiFunction.encodeData(abi, ['0xffffffffffffffffffffffffffffffffffffffff', 0n])
    const encodedDataBytes = Bytes.fromHex(encodedData)
    const maskedHex = encodedDataBytes
      .slice(Number(permission.rules[1].offset), Number(permission.rules[1].offset) + 32)
      .map((b, i) => b & permission.rules[1].mask[i]!)
    expect(Bytes.toHex(maskedHex)).toEqual('0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff')
  })

  it('should build a permission on a signature with a bool param', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('function foo(bytes data, bool flag)')
      .withBoolParam('flag', true)
      .build()
    // Check
    expect(permission).toEqual({
      target: TARGET,
      rules: [
        {
          cumulative: false,
          operation: Permission.ParameterOperation.EQUAL,
          value: Bytes.padRight(Bytes.fromHex('0xa8889a95'), 32), // cast sig "function foo(bytes,bool)"
          offset: 0n,
          mask: Permission.MASK.SELECTOR,
        },
        {
          cumulative: false,
          operation: Permission.ParameterOperation.EQUAL,
          value: Bytes.fromNumber(1n, { size: 32 }),
          offset: 4n + 32n,
          mask: Permission.MASK.BOOL,
        },
      ],
    })
    // Check the offset matches the encoding by ox
    const abi = AbiFunction.from('function foo(bytes data, bool flag)')
    const encodedData = AbiFunction.encodeData(abi, [Constants.ZeroAddress, true])
    const encodedDataBytes = Bytes.fromHex(encodedData)
    const maskedHex = encodedDataBytes
      .slice(Number(permission.rules[1].offset), Number(permission.rules[1].offset) + 32)
      .map((b, i) => b & permission.rules[1].mask[i]!)
    expect(Bytes.toBoolean(maskedHex, { size: 32 })).toEqual(true)
    const encodedData2 = AbiFunction.encodeData(abi, [Constants.ZeroAddress, false])
    const encodedDataBytes2 = Bytes.fromHex(encodedData2)
    const maskedHex2 = encodedDataBytes2
      .slice(Number(permission.rules[1].offset), Number(permission.rules[1].offset) + 32)
      .map((b, i) => b & permission.rules[1].mask[i]!)
    expect(Bytes.toBoolean(maskedHex2, { size: 32 })).toEqual(false)
  })

  it('should build a permission on a signature with a dynamic string param', () => {
    const strLen = Bytes.fromString(STRING_VALUE).length
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('function foo(string data, bool flag)')
      .withStringParam('data', STRING_VALUE)
      .build()

    // Selector
    expect(permission.target).toEqual(TARGET)
    expect(permission.rules.length).toEqual(Math.ceil(strLen / 32) + 3) // Selector, pointer, data size, data chunks
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0xb91c339f'), 32),
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })
    // Pointer
    expect(permission.rules[1]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.fromNumber(32n + 32n, { size: 32 }), // Pointer value excludes selector
      offset: 4n,
      mask: Permission.MASK.UINT256,
    })
    // Data size
    expect(permission.rules[2]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.fromNumber(BigInt(strLen), { size: 32 }),
      offset: 4n + 32n + 32n, // Pointer offset includes selector
      mask: Permission.MASK.UINT256,
    })
    // We should be able to decode the required string from the rules
    const dataSize = Bytes.toBigInt(permission.rules[2].value)
    const ruleBytes = Bytes.concat(...permission.rules.slice(3).map((r) => r.value)).slice(0, Number(dataSize))
    const decoded = Bytes.toString(ruleBytes)
    expect(decoded).toEqual(STRING_VALUE)

    // Check the offset matches the encoding by ox
    const abi = AbiFunction.from('function foo(string data, bool flag)')
    const encodedData = AbiFunction.encodeData(abi, [STRING_VALUE, true])
    const encodedDataBytes = Bytes.fromHex(encodedData)
    for (let i = 0; i < permission.rules.length; i++) {
      const maskedHex = encodedDataBytes
        .slice(Number(permission.rules[i].offset), Number(permission.rules[i].offset) + 32)
        .map((b, j) => b & permission.rules[i].mask[j]!)
      expect(Bytes.toHex(maskedHex)).toEqual(Bytes.toHex(permission.rules[i].value))
    }
  })

  it('should not support encoding dynamic params with multiple in signature', () => {
    expect(() =>
      PermissionBuilder.for(TARGET)
        .forFunction('function foo(string data, bool flag, string data2)')
        .withStringParam('data2', STRING_VALUE)
        .build(),
    ).toThrow()
  })

  it('should error when the param name or index is invalid', () => {
    expect(() =>
      PermissionBuilder.for(TARGET)
        .forFunction('function foo(bytes data, bool flag)')
        .withBoolParam('flag2', true)
        .build(),
    ).toThrow()
    expect(() =>
      PermissionBuilder.for(TARGET)
        .forFunction('function foo(bytes data, bool flag)')
        .withBoolParam('data', true)
        .build(),
    ).toThrow()
    expect(() =>
      PermissionBuilder.for(TARGET).forFunction('function foo(bytes data, bool flag)').withBoolParam(0, true).build(),
    ).toThrow()
    expect(() =>
      PermissionBuilder.for(TARGET).forFunction('function foo(bytes data, bool flag)').withBoolParam(2, true).build(),
    ).toThrow()
    expect(() =>
      PermissionBuilder.for(TARGET).forFunction('function foo(bytes,bool)').withBoolParam('flag', true).build(),
    ).toThrow()
    const abiFunc = AbiFunction.from('function foo(bytes data, bool flag)')
    expect(() => PermissionBuilder.for(TARGET).forFunction(abiFunc).withBoolParam('flag2', true).build()).toThrow()
    expect(() => PermissionBuilder.for(TARGET).forFunction(abiFunc).withBoolParam('data', true).build()).toThrow()
    expect(() => PermissionBuilder.for(TARGET).forFunction(abiFunc).withBoolParam(0, true).build()).toThrow()
    expect(() => PermissionBuilder.for(TARGET).forFunction(abiFunc).withBoolParam(2, true).build()).toThrow()
  })

  // Additional tests for 100% coverage

  it('should build a permission with dynamic bytes param', () => {
    const bytesValue = Bytes.fromHex('0x1234567890abcdef')
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('function foo(bytes data, bool flag)')
      .withBytesParam('data', bytesValue)
      .build()

    expect(permission.target).toEqual(TARGET)
    expect(permission.rules.length).toEqual(4) // Selector, pointer, data size, data chunk

    // Check selector
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0xa8889a95'), 32),
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    // Check pointer
    expect(permission.rules[1]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.fromNumber(64n, { size: 32 }), // Points to start of dynamic data
      offset: 4n,
      mask: Permission.MASK.UINT256,
    })

    // Check data length
    expect(permission.rules[2]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.fromNumber(BigInt(bytesValue.length), { size: 32 }),
      offset: 4n + 64n,
      mask: Permission.MASK.UINT256,
    })

    // Check data chunk
    expect(permission.rules[3]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(bytesValue, 32),
      offset: 4n + 64n + 32n,
      mask: Permission.MASK.BYTES32,
    })
  })

  it('should test different uint bit sizes', () => {
    const builder = PermissionBuilder.for(TARGET).forFunction(
      'function test(uint8 a, uint16 b, uint32 c, uint64 d, uint128 e)',
    )

    // Test uint8
    let permission = builder.withUintNParam('a', 255n, 8).build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.UINT8)

    // Test uint16
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(uint8 a, uint16 b, uint32 c, uint64 d, uint128 e)')
      .withUintNParam('b', 65535n, 16)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.UINT16)

    // Test uint32
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(uint8 a, uint16 b, uint32 c, uint64 d, uint128 e)')
      .withUintNParam('c', 4294967295n, 32)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.UINT32)

    // Test uint64
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(uint8 a, uint16 b, uint32 c, uint64 d, uint128 e)')
      .withUintNParam('d', 18446744073709551615n, 64)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.UINT64)

    // Test uint128
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(uint8 a, uint16 b, uint32 c, uint64 d, uint128 e)')
      .withUintNParam('e', 340282366920938463463374607431768211455n, 128)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.UINT128)
  })

  it('should test different int bit sizes', () => {
    // Test int8 - use positive values since Bytes.fromNumber doesn't handle negative
    let permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(int8 a)')
      .withIntNParam('a', 127n, 8) // Use positive value
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.INT8)

    // Test int16
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(int16 a)')
      .withIntNParam('a', 32767n, 16) // Use positive value
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.INT16)

    // Test int32
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(int32 a)')
      .withIntNParam('a', 2147483647n, 32) // Use positive value
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.INT32)

    // Test int64
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(int64 a)')
      .withIntNParam('a', 9223372036854775807n, 64) // Use positive value
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.INT64)

    // Test int128
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(int128 a)')
      .withIntNParam('a', 170141183460469231731687303715884105727n, 128) // Use positive value
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.INT128)

    // Test int256 (default)
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(int256 a)')
      .withIntNParam('a', 57896044618658097711785492504343953926634992332820282019728792003956564819967n) // Use positive value
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.INT256)
  })

  it('should test different bytesN sizes', () => {
    // Test bytes1
    let permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(bytes1 a)')
      .withBytesNParam('a', Bytes.fromHex('0x12'), 1)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.BYTES1)

    // Test bytes2
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(bytes2 a)')
      .withBytesNParam('a', Bytes.fromHex('0x1234'), 2)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.BYTES2)

    // Test bytes4
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(bytes4 a)')
      .withBytesNParam('a', Bytes.fromHex('0x12345678'), 4)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.BYTES4)

    // Test bytes8
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(bytes8 a)')
      .withBytesNParam('a', Bytes.fromHex('0x1234567890abcdef'), 8)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.BYTES8)

    // Test bytes16
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(bytes16 a)')
      .withBytesNParam('a', Bytes.fromHex('0x1234567890abcdef1234567890abcdef'), 16)
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.BYTES16)

    // Test bytes32 (default)
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(bytes32 a)')
      .withBytesNParam('a', Bytes.fromHex('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'))
      .build()
    expect(permission.rules[1].mask).toEqual(Permission.MASK.BYTES32)
  })

  it('should test cumulative parameter rules', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('function transfer(address to, uint256 value)')
      .withUintNParam('value', UINT256_VALUE, 256, Permission.ParameterOperation.LESS_THAN_OR_EQUAL, true)
      .build()

    expect(permission.rules[1].cumulative).toBe(true)
  })

  it('should test different parameter operations', () => {
    // Test NOT_EQUAL
    let permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(uint256 a)')
      .withUintNParam('a', 100n, 256, Permission.ParameterOperation.NOT_EQUAL)
      .build()
    expect(permission.rules[1].operation).toEqual(Permission.ParameterOperation.NOT_EQUAL)

    // Test GREATER_THAN_OR_EQUAL
    permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(uint256 a)')
      .withUintNParam('a', 100n, 256, Permission.ParameterOperation.GREATER_THAN_OR_EQUAL)
      .build()
    expect(permission.rules[1].operation).toEqual(Permission.ParameterOperation.GREATER_THAN_OR_EQUAL)
  })

  it('should test bool param with false value', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(bool flag)')
      .withBoolParam('flag', false)
      .build()

    expect(permission.rules[1].value).toEqual(Bytes.fromNumber(0n, { size: 32 }))
  })

  it('should test address param with different operations', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(address addr)')
      .withAddressParam('addr', TARGET2, Permission.ParameterOperation.NOT_EQUAL)
      .build()

    expect(permission.rules[1].operation).toEqual(Permission.ParameterOperation.NOT_EQUAL)
  })

  it('should test parameter access by index', () => {
    const permission = PermissionBuilder.for(TARGET)
      .forFunction('function test(address to, uint256 value)')
      .withUintNParam(1, UINT256_VALUE) // Access second parameter by index
      .build()

    expect(permission.rules[1].offset).toEqual(4n + 32n) // Second parameter offset
  })

  it('should test AbiFunction input', () => {
    const abiFunc = AbiFunction.from('function transfer(address to, uint256 value)')
    const permission = PermissionBuilder.for(TARGET).forFunction(abiFunc).build()

    expect(permission.rules[0].value).toEqual(Bytes.padRight(Bytes.fromHex('0xa9059cbb'), 32))
  })

  it('should test error cases', () => {
    // Test calling allowAll after adding rules
    expect(() =>
      PermissionBuilder.for(TARGET)
        .forFunction('function test(uint256 a)') // Use valid function signature
        .allowAll(),
    ).toThrow('cannot call allowAll() after adding rules')

    // Test calling exactCalldata after allowAll
    expect(() => PermissionBuilder.for(TARGET).allowAll().exactCalldata(Bytes.fromHex('0x1234'))).toThrow(
      'cannot call exactCalldata() after calling allowAll() or adding rules',
    )

    // Test calling forFunction after allowAll
    expect(() => PermissionBuilder.for(TARGET).allowAll().forFunction('function test(uint256 a)')).toThrow(
      'cannot call forFunction(...) after calling allowAll() or exactCalldata()',
    )

    // Test calling forFunction after exactCalldata
    expect(() =>
      PermissionBuilder.for(TARGET).exactCalldata(Bytes.fromHex('0x1234')).forFunction('function test(uint256 a)'),
    ).toThrow('cannot call forFunction(...) after calling allowAll() or exactCalldata()')

    // Test calling onlyOnce without rules
    expect(() => PermissionBuilder.for(TARGET).onlyOnce()).toThrow(
      'must call forFunction(...) before calling onlyOnce()',
    )

    // Test calling onlyOnce without selector rule
    expect(() => PermissionBuilder.for(TARGET).exactCalldata(Bytes.fromHex('0x1234')).onlyOnce()).toThrow(
      'can call onlyOnce() after adding rules that match the selector',
    )

    // Test calling parameter methods before forFunction
    expect(() => PermissionBuilder.for(TARGET).withUintNParam('value', 100n)).toThrow(
      'must call forFunction(...) first',
    )

    expect(() => PermissionBuilder.for(TARGET).withAddressParam('addr', TARGET2)).toThrow(
      'must call forFunction(...) first',
    )

    expect(() => PermissionBuilder.for(TARGET).withBoolParam('flag', true)).toThrow('must call forFunction(...) first')
  })

  it('should test parseSignature edge cases', () => {
    // Test function with no parameters - should now work after bug fix
    const permission = PermissionBuilder.for(TARGET).forFunction('function test()').build()
    expect(permission.rules).toHaveLength(1) // Only selector rule

    // Test function with unnamed parameters
    expect(() =>
      PermissionBuilder.for(TARGET).forFunction('function test(uint256)').withUintNParam('value', 100n),
    ).toThrow() // Should fail because parameter has no name
  })
})

describe('ERC20PermissionBuilder', () => {
  it('should build transfer permission', () => {
    const limit = 1000000000000000000n // 1 token
    const permission = Utils.ERC20PermissionBuilder.buildTransfer(TARGET, limit)

    expect(permission.target).toEqual(TARGET)
    expect(permission.rules).toHaveLength(2)

    // Check selector rule
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0xa9059cbb'), 32), // transfer selector
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    // Check value limit rule
    expect(permission.rules[1]).toEqual({
      cumulative: true,
      operation: Permission.ParameterOperation.LESS_THAN_OR_EQUAL,
      value: Bytes.fromNumber(limit, { size: 32 }),
      offset: 4n + 32n, // Second parameter (value)
      mask: Permission.MASK.UINT256,
    })
  })

  it('should build approve permission', () => {
    const spender = TARGET2
    const limit = 1000000000000000000n // 1 token
    const permission = Utils.ERC20PermissionBuilder.buildApprove(TARGET, spender, limit)

    expect(permission.target).toEqual(TARGET)
    expect(permission.rules).toHaveLength(3)

    // Check selector rule
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0x095ea7b3'), 32), // approve selector
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    // Check spender rule
    expect(permission.rules[1]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.concat(Bytes.fromHex('0x000000000000000000000000'), Bytes.fromHex(spender)),
      offset: 4n, // First parameter (spender)
      mask: Permission.MASK.ADDRESS,
    })

    // Check value limit rule
    expect(permission.rules[2]).toEqual({
      cumulative: true,
      operation: Permission.ParameterOperation.LESS_THAN_OR_EQUAL,
      value: Bytes.fromNumber(limit, { size: 32 }),
      offset: 4n + 32n, // Second parameter (value)
      mask: Permission.MASK.UINT256,
    })
  })
})

describe('ERC721PermissionBuilder', () => {
  it('should build transfer permission', () => {
    const tokenId = 123n
    const permission = Utils.ERC721PermissionBuilder.buildTransfer(TARGET, tokenId)

    expect(permission.target).toEqual(TARGET)
    expect(permission.rules).toHaveLength(2)

    // Check selector rule
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0x23b872dd'), 32), // transferFrom selector
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    // Check tokenId rule
    expect(permission.rules[1]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.fromNumber(tokenId, { size: 32 }),
      offset: 4n + 64n, // Third parameter (tokenId)
      mask: Permission.MASK.UINT256,
    })
  })

  it('should build approve permission', () => {
    const spender = TARGET2
    const tokenId = 123n
    const permission = Utils.ERC721PermissionBuilder.buildApprove(TARGET, spender, tokenId)

    expect(permission.target).toEqual(TARGET)
    expect(permission.rules).toHaveLength(3)

    // Check selector rule
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0x095ea7b3'), 32), // approve selector
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    // Check spender rule
    expect(permission.rules[1]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.concat(Bytes.fromHex('0x000000000000000000000000'), Bytes.fromHex(spender)),
      offset: 4n, // First parameter (spender)
      mask: Permission.MASK.ADDRESS,
    })

    // Check tokenId rule
    expect(permission.rules[2]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.fromNumber(tokenId, { size: 32 }),
      offset: 4n + 32n, // Second parameter (tokenId)
      mask: Permission.MASK.UINT256,
    })
  })
})

describe('ERC1155PermissionBuilder', () => {
  it('should build transfer permission', () => {
    // Bug is now fixed - should work correctly
    const tokenId = 123n
    const limit = 10n
    const permission = Utils.ERC1155PermissionBuilder.buildTransfer(TARGET, tokenId, limit)

    expect(permission.target).toEqual(TARGET)
    expect(permission.rules).toHaveLength(3)

    // Check selector rule
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0xf242432a'), 32), // safeTransferFrom selector
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    // Check tokenId rule (now correctly uses 'id' parameter)
    expect(permission.rules[1]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.fromNumber(tokenId, { size: 32 }),
      offset: 4n + 64n, // Third parameter (id)
      mask: Permission.MASK.UINT256,
    })

    // Check amount rule
    expect(permission.rules[2]).toEqual({
      cumulative: true,
      operation: Permission.ParameterOperation.LESS_THAN_OR_EQUAL,
      value: Bytes.fromNumber(limit, { size: 32 }),
      offset: 4n + 96n, // Fourth parameter (amount)
      mask: Permission.MASK.UINT256,
    })
  })

  it('should build approve all permission', () => {
    const operator = TARGET2
    const permission = Utils.ERC1155PermissionBuilder.buildApproveAll(TARGET, operator)

    expect(permission.target).toEqual(TARGET)
    expect(permission.rules).toHaveLength(2)

    // Check selector rule
    expect(permission.rules[0]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.fromHex('0xa22cb465'), 32), // setApprovalForAll selector
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    // Check operator rule
    expect(permission.rules[1]).toEqual({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.concat(Bytes.fromHex('0x000000000000000000000000'), Bytes.fromHex(operator)),
      offset: 4n, // First parameter (operator)
      mask: Permission.MASK.ADDRESS,
    })
  })
})
