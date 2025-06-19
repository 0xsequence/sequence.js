import { AbiParameters, Address, Bytes } from 'ox'

export enum ParameterOperation {
  EQUAL = 0,
  NOT_EQUAL = 1,
  GREATER_THAN_OR_EQUAL = 2,
  LESS_THAN_OR_EQUAL = 3,
}

export type ParameterRule = {
  cumulative: boolean
  operation: ParameterOperation
  value: Bytes.Bytes
  offset: bigint
  mask: Bytes.Bytes
}

export type Permission = {
  target: Address.Address
  rules: ParameterRule[]
}

export type SessionPermissions = {
  signer: Address.Address
  valueLimit: bigint
  deadline: bigint // uint64
  permissions: [Permission, ...Permission[]]
}

export const MAX_PERMISSIONS_COUNT = 2 ** 7 - 1
export const MAX_RULES_COUNT = 2 ** 8 - 1

export const SELECTOR_MASK = Bytes.padRight(Bytes.fromHex('0xffffffff'), 32) // Select intentionally pads right. Other values should pad left
export const ADDRESS_MASK = Bytes.padLeft(Bytes.fromHex('0xffffffffffffffffffffffffffffffffffffffff'), 32)
export const UINT256_MASK = Bytes.fromHex('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', {
  size: 32,
})

// Encoding

export function encodeSessionPermissions(sessionPermissions: SessionPermissions): Bytes.Bytes {
  if (sessionPermissions.permissions.length > MAX_PERMISSIONS_COUNT) {
    throw new Error('Too many permissions')
  }

  const encodedPermissions = sessionPermissions.permissions.map(encodePermission)

  return Bytes.concat(
    Bytes.padLeft(Bytes.fromHex(sessionPermissions.signer), 20),
    Bytes.padLeft(Bytes.fromNumber(sessionPermissions.valueLimit), 32),
    Bytes.padLeft(Bytes.fromNumber(sessionPermissions.deadline, { size: 8 }), 8),
    Bytes.fromNumber(sessionPermissions.permissions.length, { size: 1 }),
    Bytes.concat(...encodedPermissions),
  )
}

export function encodePermission(permission: Permission): Bytes.Bytes {
  if (permission.rules.length > MAX_RULES_COUNT) {
    throw new Error('Too many rules')
  }

  const encodedRules = permission.rules.map(encodeParameterRule)
  return Bytes.concat(
    Bytes.padLeft(Bytes.fromHex(permission.target), 20),
    Bytes.fromNumber(permission.rules.length, { size: 1 }),
    Bytes.concat(...encodedRules),
  )
}

function encodeParameterRule(rule: ParameterRule): Bytes.Bytes {
  // Combine operation and cumulative flag into a single byte
  // 0x[operationx3][cumulative]
  const operationCumulative = (Number(rule.operation) << 1) | (rule.cumulative ? 1 : 0)

  return Bytes.concat(
    Bytes.fromNumber(operationCumulative),
    Bytes.padLeft(rule.value, 32),
    Bytes.padLeft(Bytes.fromNumber(rule.offset), 32),
    Bytes.padLeft(rule.mask, 32),
  )
}

// Decoding

export function decodeSessionPermissions(bytes: Bytes.Bytes): SessionPermissions {
  const signer = Bytes.toHex(bytes.slice(0, 20))
  const valueLimit = Bytes.toBigInt(bytes.slice(20, 52))
  const deadline = Bytes.toBigInt(bytes.slice(52, 60))
  const permissionsLength = Number(bytes[60]!)
  const permissions = []
  let pointer = 61
  for (let i = 0; i < permissionsLength; i++) {
    // Pass the remaining bytes instead of a fixed slice length
    const { permission, consumed } = decodePermission(bytes.slice(pointer))
    permissions.push(permission)
    pointer += consumed
  }
  if (permissions.length === 0) {
    throw new Error('No permissions')
  }
  return {
    signer,
    valueLimit,
    deadline,
    permissions: permissions as [Permission, ...Permission[]],
  }
}

// Returns the permission and the number of bytes consumed in the permission block
function decodePermission(bytes: Bytes.Bytes): { permission: Permission; consumed: number } {
  const target = Bytes.toHex(bytes.slice(0, 20))
  const rulesLength = Number(bytes[20]!)
  const rules = []
  let pointer = 21
  for (let i = 0; i < rulesLength; i++) {
    const ruleBytes = bytes.slice(pointer, pointer + 97)
    rules.push(decodeParameterRule(ruleBytes))
    pointer += 97
  }
  return {
    permission: {
      target,
      rules,
    },
    consumed: pointer,
  }
}

function decodeParameterRule(bytes: Bytes.Bytes): ParameterRule {
  const operationCumulative = Number(bytes[0]!)
  const cumulative = (operationCumulative & 1) === 1
  const operation = operationCumulative >> 1
  const value = bytes.slice(1, 33)
  const offset = Bytes.toBigInt(bytes.slice(33, 65))
  const mask = bytes.slice(65, 97)
  return {
    cumulative,
    operation,
    value,
    offset,
    mask,
  }
}

// ABI encode

export const permissionStructAbi = {
  internalType: 'struct Permission',
  name: 'permission',
  type: 'tuple',
  components: [
    { internalType: 'address', name: 'target', type: 'address' },
    {
      internalType: 'struct ParameterRule[]',
      name: 'rules',
      type: 'tuple[]',
      components: [
        { internalType: 'bool', name: 'cumulative', type: 'bool' },
        {
          internalType: 'enum ParameterOperation',
          name: 'operation',
          type: 'uint8',
        },
        { internalType: 'bytes32', name: 'value', type: 'bytes32' },
        { internalType: 'uint256', name: 'offset', type: 'uint256' },
        { internalType: 'bytes32', name: 'mask', type: 'bytes32' },
      ],
    },
  ],
} as const

export function abiEncodePermission(permission: Permission): string {
  return AbiParameters.encode(
    [permissionStructAbi],
    [
      {
        target: permission.target,
        rules: permission.rules.map((rule) => ({
          cumulative: rule.cumulative,
          operation: rule.operation,
          value: Bytes.toHex(rule.value),
          offset: rule.offset,
          mask: Bytes.toHex(rule.mask),
        })),
      },
    ],
  )
}

// JSON

export function sessionPermissionsToJson(sessionPermissions: SessionPermissions): string {
  return JSON.stringify(encodeSessionPermissionsForJson(sessionPermissions))
}

export function encodeSessionPermissionsForJson(sessionPermissions: SessionPermissions): any {
  return {
    signer: sessionPermissions.signer.toString(),
    valueLimit: sessionPermissions.valueLimit.toString(),
    deadline: sessionPermissions.deadline.toString(),
    permissions: sessionPermissions.permissions.map(encodePermissionForJson),
  }
}

export function permissionToJson(permission: Permission): string {
  return JSON.stringify(encodePermissionForJson(permission))
}

function encodePermissionForJson(permission: Permission): any {
  return {
    target: permission.target.toString(),
    rules: permission.rules.map(encodeParameterRuleForJson),
  }
}

export function parameterRuleToJson(rule: ParameterRule): string {
  return JSON.stringify(encodeParameterRuleForJson(rule))
}

function encodeParameterRuleForJson(rule: ParameterRule): any {
  return {
    cumulative: rule.cumulative,
    operation: rule.operation,
    value: Bytes.toHex(rule.value),
    offset: rule.offset.toString(),
    mask: Bytes.toHex(rule.mask),
  }
}

export function sessionPermissionsFromJson(json: string): SessionPermissions {
  return sessionPermissionsFromParsed(JSON.parse(json))
}

export function sessionPermissionsFromParsed(parsed: any): SessionPermissions {
  return {
    signer: Address.from(parsed.signer),
    valueLimit: BigInt(parsed.valueLimit),
    deadline: BigInt(parsed.deadline),
    permissions: parsed.permissions.map(permissionFromParsed),
  }
}

export function permissionFromJson(json: string): Permission {
  return permissionFromParsed(JSON.parse(json))
}

function permissionFromParsed(parsed: any): Permission {
  return {
    target: Address.from(parsed.target),
    rules: parsed.rules.map((decoded: any) => ({
      cumulative: decoded.cumulative,
      operation: decoded.operation,
      value: Bytes.fromHex(decoded.value),
      offset: BigInt(decoded.offset),
      mask: Bytes.fromHex(decoded.mask),
    })),
  }
}
