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
    Bytes.padLeft(Bytes.fromNumber(sessionPermissions.permissions.length), 3),
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

export function sessionPermissionsToJson(sessionPermissions: SessionPermissions): string {
  return JSON.stringify(encodeSessionPermissionsForJson(sessionPermissions))
}

function encodeSessionPermissionsForJson(sessionPermissions: SessionPermissions): any {
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
