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
  value: bigint
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
    Bytes.padLeft(Bytes.fromNumber(rule.value), 32),
    Bytes.padLeft(Bytes.fromNumber(rule.offset), 32),
    Bytes.padLeft(rule.mask, 32),
  )
}
