import { Address, Bytes } from 'ox'

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
  deadline: bigint
  permissions: Permission[]
}

// Encoding

export function encodeSessionPermissions(sessionPermissions: SessionPermissions): Bytes.Bytes {
  const encodedPermissions = sessionPermissions.permissions.map(encodePermission)

  return Bytes.concat(
    Bytes.padLeft(Bytes.fromHex(sessionPermissions.signer), 20),
    Bytes.padLeft(Bytes.fromNumber(sessionPermissions.valueLimit), 32),
    Bytes.padLeft(Bytes.fromNumber(sessionPermissions.deadline), 32),
    Bytes.padLeft(Bytes.fromNumber(encodedPermissions.length), 3),
    Bytes.concat(...encodedPermissions),
  )
}

export function encodePermission(permission: Permission): Bytes.Bytes {
  const encodedRules = permission.rules.map(encodeParameterRule)
  return Bytes.concat(
    Bytes.padLeft(Bytes.fromHex(permission.target), 20),
    Bytes.padLeft(Bytes.fromNumber(permission.rules.length), 3),
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

// JSON

export function permissionToJson(permission: Permission): string {
  return JSON.stringify({
    target: permission.target.toString(),
    rules: permission.rules.map(permissionRuleToJson),
  })
}

export function permissionRuleToJson(rule: ParameterRule): string {
  return JSON.stringify({
    cumulative: rule.cumulative,
    operation: rule.operation,
    value: rule.value.toString(),
    offset: rule.offset.toString(),
    mask: rule.mask.toString(),
  })
}

export function permissionFromJson(json: string): Permission {
  const parsed = JSON.parse(json)
  const res = {
    target: Address.from(parsed.target),
    rules: parsed.rules.map((decoded: any) => ({
      cumulative: decoded.cumulative,
      operation: decoded.operation,
      value: Bytes.fromHex(decoded.value),
      offset: BigInt(decoded.offset),
      mask: Bytes.fromHex(decoded.mask),
    })),
  }
  return res
}
