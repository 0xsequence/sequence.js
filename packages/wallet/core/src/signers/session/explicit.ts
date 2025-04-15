import { Payload, Permission, SessionSignature, Utils } from '@0xsequence/wallet-primitives'
import { AbiParameters, Address, Bytes, Hash, Hex, Provider, Secp256k1 } from 'ox'
import { SignerInterface } from './session'

export type ExplicitParams = Omit<Permission.SessionPermissions, 'signer'>

export class Explicit implements SignerInterface {
  readonly address: Address.Address
  readonly sessionPermissions: Permission.SessionPermissions

  constructor(
    private readonly _privateKey: `0x${string}`,
    sessionPermissions: ExplicitParams,
  ) {
    this.address = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: this._privateKey }))
    this.sessionPermissions = {
      ...sessionPermissions,
      signer: this.address,
    }
  }

  async findSupportedPermission(
    wallet: Address.Address,
    _chainId: bigint,
    call: Payload.Call,
    provider: Provider.Provider,
  ): Promise<Permission.Permission | undefined> {
    // Wallet and signer are encoded as a prefix for the usage hash
    const limitHashPrefix = Hash.keccak256(
      AbiParameters.encode(
        [
          { type: 'address', name: 'wallet' },
          { type: 'address', name: 'signer' },
        ],
        [wallet, this.address],
      ),
    )
    for (const [permissionIndex, permission] of this.sessionPermissions.permissions.entries()) {
      // Encode the permission and permission index as a parameter for the usage hash
      const encodeParams = [
        { type: 'bytes32', name: 'limitHashPrefix' },
        Permission.permissionStructAbi,
        { type: 'uint256', name: 'permissionIndex' },
      ] as const
      const usageHash = Hash.keccak256(
        AbiParameters.encode(encodeParams, [
          limitHashPrefix,
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
          BigInt(permissionIndex),
        ]),
      )
      // Validate the permission
      if (await validatePermission(permission, call, provider, usageHash)) {
        return permission
      }
    }
    return undefined
  }

  async supportedCall(
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    provider: Provider.Provider,
  ): Promise<boolean> {
    //FIXME Should this be stateful to support cumulative rules within a payload?
    const permission = await this.findSupportedPermission(wallet, chainId, call, provider)
    if (!permission) {
      return false
    }
    return true
  }

  async signCall(
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    nonce: {
      space: bigint
      nonce: bigint
    },
    provider: Provider.Provider,
  ): Promise<SessionSignature.SessionCallSignature> {
    // Find the valid permission for this call
    const permission = await this.findSupportedPermission(wallet, chainId, call, provider)
    if (!permission) {
      // This covers the support check
      throw new Error('Invalid permission')
    }
    const permissionIndex = this.sessionPermissions.permissions.indexOf(permission)
    if (permissionIndex === -1) {
      // Unreachable
      throw new Error('Invalid permission')
    }
    // Sign it
    const callHash = SessionSignature.hashCallWithReplayProtection(call, chainId, nonce.space, nonce.nonce)
    const sessionSignature = Secp256k1.sign({ payload: callHash, privateKey: this._privateKey })
    return {
      permissionIndex: BigInt(permissionIndex),
      sessionSignature,
    }
  }
}

async function validatePermission(
  permission: Permission.Permission,
  call: Payload.Call,
  provider?: Provider.Provider,
  usageHash?: Hex.Hex,
): Promise<boolean> {
  if (permission.target !== call.to) {
    return false
  }

  for (const rule of permission.rules) {
    // Extract value from calldata at offset
    const callValue = call.data.slice(Number(rule.offset), Number(rule.offset) + 32)
    // Apply mask
    let value: Bytes.Bytes = callValue.map((b, i) => b & rule.mask[i]!)

    if (rule.cumulative) {
      if (provider && usageHash) {
        // Get the cumulative value from the contract storage
        const storageSlot = Utils.getStorageSlotForMappingWithKey(Hex.toBigInt(usageHash), Hex.fromBytes(rule.value))
        const storageValue = await provider.request({
          method: 'eth_getStorageAt',
          params: [permission.target, storageSlot, 'latest'],
        })
        // Increment the value
        value = Bytes.fromNumber(Hex.toBigInt(storageValue) + Bytes.toBigInt(value))
      } else {
        throw new Error('Cumulative rules require a provider and usage hash')
      }
    }

    // Compare based on operation
    if (rule.operation === Permission.ParameterOperation.EQUAL) {
      if (!Bytes.isEqual(value, rule.value)) {
        return false
      }
    }

    if (rule.operation === Permission.ParameterOperation.LESS_THAN_OR_EQUAL) {
      if (Bytes.toBigInt(value) > Bytes.toBigInt(rule.value)) {
        return false
      }
    }

    if (rule.operation === Permission.ParameterOperation.NOT_EQUAL) {
      if (Bytes.isEqual(value, rule.value)) {
        return false
      }
    }

    if (rule.operation === Permission.ParameterOperation.GREATER_THAN_OR_EQUAL) {
      if (Bytes.toBigInt(value) < Bytes.toBigInt(rule.value)) {
        return false
      }
    }
  }

  return true
}
