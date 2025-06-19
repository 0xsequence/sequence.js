import { Permission } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Bytes } from 'ox'

/**
 * Parses a human-readable signature like
 *   "function foo(uint256 x, address to, bytes data)"
 * into parallel arrays of types and (optional) names.
 */
function parseSignature(sig: string): { types: string[]; names: (string | undefined)[] } {
  const m = sig.match(/\(([^)]*)\)/)
  if (!m || !m[1]) throw new Error(`Invalid function signature: ${sig}`)
  const inner = m[1].trim()
  if (inner === '') return { types: [], names: [] }

  const parts = inner.split(',').map((p) => p.trim())
  const types = parts.map((p) => {
    const t = p.split(/\s+/)[0]
    if (!t) throw new Error(`Invalid parameter in signature: "${p}"`)
    return t
  })
  const names = parts.map((p) => {
    const seg = p.split(/\s+/)
    return seg.length > 1 ? seg[1] : undefined
  })

  return { types, names }
}

export class PermissionBuilder {
  private target: Address.Address
  private rules: Permission.ParameterRule[] = []
  private fnTypes?: string[]
  private fnNames?: (string | undefined)[]
  private allowAllSet: boolean = false

  private constructor(target: Address.Address) {
    this.target = target
  }

  static for(target: Address.Address): PermissionBuilder {
    return new PermissionBuilder(target)
  }

  allowAll(): this {
    if (this.rules.length > 0) {
      throw new Error(`cannot call allowAll() after adding rules`)
    }
    this.allowAllSet = true
    return this
  }

  forFunction(sig: string | AbiFunction.AbiFunction): this {
    if (this.allowAllSet) {
      throw new Error(`cannot call forFunction(...) after calling allowAll()`)
    }
    const selector = AbiFunction.getSelector(sig)
    this.rules.push({
      cumulative: false,
      operation: Permission.ParameterOperation.EQUAL,
      value: Bytes.padRight(Bytes.from(selector), 32),
      offset: 0n,
      mask: Permission.MASK.SELECTOR,
    })

    if (typeof sig === 'string') {
      const { types, names } = parseSignature(sig)
      this.fnTypes = types
      this.fnNames = names
    } else {
      const fn = AbiFunction.from(sig)
      this.fnTypes = fn.inputs.map((i) => i.type)
      this.fnNames = fn.inputs.map((i) => i.name)
    }
    return this
  }

  private findOffset(param: string | number, expectedType?: string): bigint {
    if (!this.fnTypes || !this.fnNames) {
      throw new Error(`must call forFunction(...) first`)
    }
    const idx = typeof param === 'number' ? param : this.fnNames.indexOf(param)
    if (idx < 0 || idx >= this.fnTypes.length) {
      throw new Error(`Unknown param "${param}" in function`)
    }
    if (expectedType && this.fnTypes[idx] !== expectedType) {
      throw new Error(`type "${this.fnTypes[idx]}" is not ${expectedType}; cannot apply parameter rule`)
    }
    //FIXME Does this work when there are dynamic types?
    return 4n + 32n * BigInt(idx)
  }

  private addRule(
    param: string | number,
    expectedType: string,
    mask: Bytes.Bytes,
    operation: Permission.ParameterOperation,
    rawValue: bigint | Bytes.Bytes,
    cumulative = false,
  ): this {
    const offset = this.findOffset(param, expectedType)

    // turn bigint → padded 32-byte, or Bytes → padded‐left 32-byte
    const value =
      typeof rawValue === 'bigint' ? Bytes.fromNumber(rawValue, { size: 32 }) : Bytes.padLeft(Bytes.from(rawValue), 32)

    this.rules.push({ cumulative, operation, value, offset, mask })
    return this
  }

  withUintNParam(
    param: string | number,
    value: bigint,
    bits: 8 | 16 | 32 | 64 | 128 | 256 = 256,
    operation: Permission.ParameterOperation = Permission.ParameterOperation.EQUAL,
    cumulative = false,
  ): this {
    const typeName = `uint${bits}`
    const mask = Permission.MASK[`UINT${bits}` as keyof typeof Permission.MASK]
    return this.addRule(param, typeName, mask, operation, value, cumulative)
  }

  withIntNParam(
    param: string | number,
    value: bigint,
    bits: 8 | 16 | 32 | 64 | 128 | 256 = 256,
    operation: Permission.ParameterOperation = Permission.ParameterOperation.EQUAL,
    cumulative = false,
  ): this {
    const typeName = `int${bits}`
    const mask = Permission.MASK[`INT${bits}` as keyof typeof Permission.MASK]
    return this.addRule(param, typeName, mask, operation, value, cumulative)
  }

  withBytesNParam(
    param: string | number,
    value: Bytes.Bytes,
    size: 1 | 2 | 4 | 8 | 16 | 32 = 32,
    operation: Permission.ParameterOperation = Permission.ParameterOperation.EQUAL,
    cumulative = false,
  ): this {
    const typeName = `bytes${size}`
    const mask = Permission.MASK[`BYTES${size}` as keyof typeof Permission.MASK]
    return this.addRule(param, typeName, mask, operation, value, cumulative)
  }

  withAddressParam(
    param: string | number,
    value: Address.Address,
    operation: Permission.ParameterOperation = Permission.ParameterOperation.EQUAL,
    cumulative = false,
  ): this {
    return this.addRule(
      param,
      'address',
      Permission.MASK.ADDRESS,
      operation,
      Bytes.padLeft(Bytes.fromHex(value), 32),
      cumulative,
    )
  }

  withBoolParam(
    param: string | number,
    value: boolean,
    operation: Permission.ParameterOperation = Permission.ParameterOperation.EQUAL,
    cumulative = false,
  ): this {
    // solidity bool is encoded as 0 or 1, 32-bytes left-padded
    return this.addRule(param, 'bool', Permission.MASK.BOOL, operation, value ? 1n : 0n, cumulative)
  }

  onlyOnce(): this {
    if (this.rules.length === 0) {
      throw new Error(`must call forFunction(...) before calling onlyOnce()`)
    }
    const selectorRule = this.rules.find((r) => r.offset === 0n && Bytes.isEqual(r.mask, Permission.MASK.SELECTOR))
    if (!selectorRule) {
      throw new Error(`can call onlyOnce() after adding rules that match the selector`)
    }
    // Update the selector rule to be cumulative. This ensure the selector rule can only be matched once.
    selectorRule.cumulative = true
    return this
  }

  build(): Permission.Permission {
    if (this.rules.length === 0 && !this.allowAllSet) {
      throw new Error(`must call forFunction(...) or allowAll() before calling build()`)
    }
    return {
      target: this.target,
      rules: this.rules,
    }
  }
}
