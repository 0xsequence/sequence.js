import { Payload, Permission, SessionSignature, Constants } from '@0xsequence/wallet-primitives'
import { AbiFunction, AbiParameters, Address, Bytes, Hash, Hex, Provider } from 'ox'
import { MemoryPkStore, PkStore } from '../pk/index.js'
import { ExplicitSessionSigner, UsageLimit } from './session.js'

export type ExplicitParams = Omit<Permission.SessionPermissions, 'signer'>

const VALUE_TRACKING_ADDRESS: Address.Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export class Explicit implements ExplicitSessionSigner {
  private readonly _privateKey: PkStore

  public readonly address: Address.Address
  public readonly sessionPermissions: Permission.SessionPermissions

  constructor(privateKey: Hex.Hex | PkStore, sessionPermissions: ExplicitParams) {
    this._privateKey = typeof privateKey === 'string' ? new MemoryPkStore(privateKey) : privateKey
    this.address = this._privateKey.address()
    this.sessionPermissions = {
      ...sessionPermissions,
      signer: this.address,
    }
  }

  async findSupportedPermission(
    wallet: Address.Address,
    _chainId: bigint,
    call: Payload.Call,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<Permission.Permission | undefined> {
    if (call.value !== 0n) {
      // Validate the value
      if (!provider) {
        throw new Error('Value transaction validation requires a provider')
      }
      const usageHash = Hash.keccak256(
        AbiParameters.encode(
          [
            { type: 'address', name: 'signer' },
            { type: 'address', name: 'valueTrackingAddress' },
          ],
          [this.address, VALUE_TRACKING_ADDRESS],
        ),
      )
      const { usageAmount } = await this.readCurrentUsageLimit(wallet, sessionManagerAddress, usageHash, provider)
      const value = Bytes.fromNumber(usageAmount + call.value, { size: 32 })
      if (Bytes.toBigInt(value) > this.sessionPermissions.valueLimit) {
        return undefined
      }
    }

    for (const permission of this.sessionPermissions.permissions) {
      // Validate the permission
      if (await this.validatePermission(permission, call, wallet, sessionManagerAddress, provider)) {
        return permission
      }
    }
    return undefined
  }

  private getPermissionUsageHash(permission: Permission.Permission, ruleIndex: number): Hex.Hex {
    const encodedPermission = {
      target: permission.target,
      rules: permission.rules.map((rule) => ({
        cumulative: rule.cumulative,
        operation: rule.operation,
        value: Bytes.toHex(rule.value),
        offset: rule.offset,
        mask: Bytes.toHex(rule.mask),
      })),
    }
    return Hash.keccak256(
      AbiParameters.encode(
        [{ type: 'address', name: 'signer' }, Permission.permissionStructAbi, { type: 'uint256', name: 'ruleIndex' }],
        [this.address, encodedPermission, BigInt(ruleIndex)],
      ),
    )
  }

  private getValueUsageHash(): Hex.Hex {
    return Hash.keccak256(
      AbiParameters.encode(
        [
          { type: 'address', name: 'signer' },
          { type: 'address', name: 'valueTrackingAddress' },
        ],
        [this.address, VALUE_TRACKING_ADDRESS],
      ),
    )
  }

  async validatePermission(
    permission: Permission.Permission,
    call: Payload.Call,
    wallet: Address.Address,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<boolean> {
    if (!Address.isEqual(permission.target, call.to)) {
      return false
    }

    for (const [ruleIndex, rule] of permission.rules.entries()) {
      // Extract value from calldata at offset
      const callDataValue = Bytes.padRight(
        Bytes.fromHex(call.data).slice(Number(rule.offset), Number(rule.offset) + 32),
        32,
      )
      // Apply mask
      let value: Bytes.Bytes = callDataValue.map((b, i) => b & rule.mask[i]!)
      if (rule.cumulative) {
        if (provider) {
          const { usageAmount } = await this.readCurrentUsageLimit(
            wallet,
            sessionManagerAddress,
            this.getPermissionUsageHash(permission, ruleIndex),
            provider,
          )
          // Increment the value
          value = Bytes.fromNumber(usageAmount + Bytes.toBigInt(value), { size: 32 })
        } else {
          throw new Error('Cumulative rules require a provider')
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

  async supportedCall(
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<boolean> {
    if (
      Hex.size(call.data) > 4 &&
      Hex.isEqual(Hex.slice(call.data, 0, 4), AbiFunction.getSelector(Constants.INCREMENT_USAGE_LIMIT))
    ) {
      // Can sign increment usage calls
      return true
    }

    const permission = await this.findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider)
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
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<SessionSignature.SessionCallSignature> {
    let permissionIndex: number
    if (
      Hex.size(call.data) > 4 &&
      Hex.isEqual(Hex.slice(call.data, 0, 4), AbiFunction.getSelector(Constants.INCREMENT_USAGE_LIMIT))
    ) {
      // Permission check not required. Use the first permission
      permissionIndex = 0
    } else {
      // Find the valid permission for this call
      const permission = await this.findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider)
      if (!permission) {
        // This covers the support check
        throw new Error('Invalid permission')
      }
      permissionIndex = this.sessionPermissions.permissions.indexOf(permission)
      if (permissionIndex === -1) {
        // Unreachable
        throw new Error('Invalid permission')
      }
    }

    // Sign it
    const callHash = SessionSignature.hashCallWithReplayProtection(call, chainId, nonce.space, nonce.nonce)
    const sessionSignature = await this._privateKey.signDigest(Bytes.fromHex(callHash))
    return {
      permissionIndex: BigInt(permissionIndex),
      sessionSignature,
    }
  }

  private async readCurrentUsageLimit(
    wallet: Address.Address,
    sessionManagerAddress: Address.Address,
    usageHash: Hex.Hex,
    provider: Provider.Provider,
  ): Promise<UsageLimit> {
    const readData = AbiFunction.encodeData(Constants.GET_LIMIT_USAGE, [wallet, usageHash])
    const getUsageLimitResult = await provider.request({
      method: 'eth_call',
      params: [
        {
          to: sessionManagerAddress,
          data: readData,
        },
        'latest',
      ],
    })
    const usageAmount = AbiFunction.decodeResult(Constants.GET_LIMIT_USAGE, getUsageLimitResult)
    return {
      usageHash,
      usageAmount,
    }
  }

  async prepareIncrements(
    wallet: Address.Address,
    chainId: bigint,
    calls: Payload.Call[],
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<UsageLimit[]> {
    const increments: { usageHash: Hex.Hex; increment: bigint }[] = []
    const usageValueHash = this.getValueUsageHash()

    for (const call of calls) {
      // Find matching permission
      const perm = await this.findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider)
      if (!perm) continue

      for (const [ruleIndex, rule] of perm.rules.entries()) {
        if (!rule.cumulative) {
          continue
        }
        // Extract the masked value
        const callDataValue = Bytes.padRight(
          Bytes.fromHex(call.data).slice(Number(rule.offset), Number(rule.offset) + 32),
          32,
        )
        let value: Bytes.Bytes = callDataValue.map((b, i) => b & rule.mask[i]!)
        if (Bytes.toBigInt(value) === 0n) continue

        // Add to list
        const usageHash = this.getPermissionUsageHash(perm, ruleIndex)
        const existingIncrement = increments.find((i) => Hex.isEqual(i.usageHash, usageHash))
        if (existingIncrement) {
          existingIncrement.increment += Bytes.toBigInt(value)
        } else {
          increments.push({
            usageHash,
            increment: Bytes.toBigInt(value),
          })
        }
      }

      // Check the value
      if (call.value !== 0n) {
        const existingIncrement = increments.find((i) => Hex.isEqual(i.usageHash, usageValueHash))
        if (existingIncrement) {
          existingIncrement.increment += call.value
        } else {
          increments.push({
            usageHash: usageValueHash,
            increment: call.value,
          })
        }
      }
    }

    // If no increments, return early
    if (increments.length === 0) {
      return []
    }

    // Provider is required if we have increments
    if (!provider) {
      throw new Error('Provider required for cumulative rules')
    }

    // Apply current usage limit to each increment
    return Promise.all(
      increments.map(async ({ usageHash, increment }) => {
        if (increment === 0n) return null

        const currentUsage = await this.readCurrentUsageLimit(wallet, sessionManagerAddress, usageHash, provider)

        // For value usage hash, validate against the limit
        if (Hex.isEqual(usageHash, usageValueHash)) {
          const totalValue = currentUsage.usageAmount + increment
          if (totalValue > this.sessionPermissions.valueLimit) {
            throw new Error('Value transaction validation failed')
          }
        }

        return {
          usageHash,
          usageAmount: currentUsage.usageAmount + increment,
        }
      }),
    ).then((results) => results.filter((r): r is UsageLimit => r !== null))
  }
}
