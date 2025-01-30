import { Address, Bytes } from 'ox'
import { Permission, encodePermission } from './permission'

export type SessionConfig = {
  signer: Address.Address
  valueLimit: bigint
  deadline: bigint
  permissions: Permission[]
}

export function encodeSessionConfig(sessionConfig: SessionConfig): Bytes.Bytes {
  const encodedPermissions = sessionConfig.permissions.map(encodePermission)
  return Bytes.concat(
    Bytes.padLeft(Bytes.fromHex(sessionConfig.signer), 20),
    Bytes.fromNumber(sessionConfig.valueLimit),
    Bytes.fromNumber(sessionConfig.deadline),
    Bytes.padLeft(Bytes.fromNumber(encodedPermissions.length), 3),
    Bytes.concat(...encodedPermissions),
  )
}
