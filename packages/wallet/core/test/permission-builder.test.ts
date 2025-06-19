import { AbiFunction, Address, Bytes } from 'ox'
import { describe, expect, it } from 'vitest'

import { Permission } from '../../primitives/src/index.js'
import { Utils } from '../src/index.js'

const { PermissionBuilder } = Utils

const TARGET = Address.from('0x1234567890123456789012345678901234567890')
const TARGET2 = Address.from('0x1234567890123456789012345678901234567891')
const UINT256_VALUE = 1000000000000000000n
const BYTES32_MAX = Bytes.fromHex('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

describe('PermissionBuilder', () => {
  it('should build an unrestricted permission', () => {
    expect(() => PermissionBuilder.for(TARGET).build()).toThrow() // Call allowAll() first

    const permission = PermissionBuilder.for(TARGET).allowAll().build()
    expect(permission).toEqual({
      target: TARGET,
      rules: [],
    })
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
    const encodedData = AbiFunction.encodeData(abi, [
      '0x0000000000000000000000000000000000000000',
      Bytes.toBigInt(BYTES32_MAX),
    ])
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

  it('should build a permission on a signature with a dynamic param', () => {
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
    const encodedData = AbiFunction.encodeData(abi, ['0x0000000000000000000000000000000000000000', true])
    const encodedDataBytes = Bytes.fromHex(encodedData)
    const maskedHex = encodedDataBytes
      .slice(Number(permission.rules[1].offset), Number(permission.rules[1].offset) + 32)
      .map((b, i) => b & permission.rules[1].mask[i]!)
    expect(Bytes.toBoolean(maskedHex, { size: 32 })).toEqual(true)
    const encodedData2 = AbiFunction.encodeData(abi, ['0x0000000000000000000000000000000000000000', false])
    const encodedDataBytes2 = Bytes.fromHex(encodedData2)
    const maskedHex2 = encodedDataBytes2
      .slice(Number(permission.rules[1].offset), Number(permission.rules[1].offset) + 32)
      .map((b, i) => b & permission.rules[1].mask[i]!)
    expect(Bytes.toBoolean(maskedHex2, { size: 32 })).toEqual(false)
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
})
