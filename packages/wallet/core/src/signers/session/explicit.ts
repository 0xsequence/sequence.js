import { Payload, Permission, SessionSignature, Utils } from '@0xsequence/wallet-primitives'
import { AbiFunction, AbiParameters, Address, Bytes, Hash, Hex, Provider } from 'ox'
import { MemoryPkStore, PkStore } from '../pk/index.js'
import { ExplicitSessionSigner, UsageLimit } from './session.js'
import { GET_LIMIT_USAGE, INCREMENT_USAGE_LIMIT } from '../../../../primitives/dist/constants.js'

export type ExplicitParams = Omit<Permission.SessionPermissions, 'signer'>

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
    for (const permission of this.sessionPermissions.permissions) {
      // Validate the permission
      if (await this.validatePermission(permission, call, wallet, sessionManagerAddress, provider)) {
        return permission
      }
    }
    return undefined
  }

  async getCurrentUsageLimit(
    wallet: Address.Address,
    sessionManagerAddress: Address.Address,
    permission: Permission.Permission,
    ruleIndex: number | bigint,
    provider?: Provider.Provider,
  ): Promise<UsageLimit> {
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

    const usageHash = Hash.keccak256(
      AbiParameters.encode(
        [{ type: 'address', name: 'signer' }, Permission.permissionStructAbi, { type: 'uint256', name: 'ruleIndex' }],
        [this.address, encodedPermission, BigInt(ruleIndex)],
      ),
    )
    const readData = AbiFunction.encodeData(GET_LIMIT_USAGE, [wallet, usageHash])
    const getUsageLimitResult = await provider!.request({
      method: 'eth_call',
      params: [
        {
          to: sessionManagerAddress,
          data: readData,
        },
      ],
    })
    const usageAmount = AbiFunction.decodeResult(GET_LIMIT_USAGE, getUsageLimitResult)
    return {
      usageHash,
      usageAmount,
    }
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
          const { usageAmount } = await this.getCurrentUsageLimit(
            wallet,
            sessionManagerAddress,
            permission,
            ruleIndex,
            provider,
          )
          // Increment the value
          value = Bytes.fromNumber(usageAmount + Bytes.toBigInt(value), { size: 32 })
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

  async supportedCall(
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<boolean> {
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
      call.data.length > 4 &&
      Hex.isEqual(Hex.slice(call.data, 0, 4), AbiFunction.getSelector(INCREMENT_USAGE_LIMIT))
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

  // FIXME This should take a list of calls to cater for overlapping permissions
  async prepareIncrements(
    wallet: Address.Address,
    chainId: bigint,
    call: Payload.Call,
    sessionManagerAddress: Address.Address,
    provider?: Provider.Provider,
  ): Promise<UsageLimit[]> {
    // Find matching permission
    const perm = await this.findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider)
    if (!perm) return []

    // Read its storage slot and add the delta
    const increments: UsageLimit[] = []
    const cumulativeRules = perm.rules.filter((r) => r.cumulative)
    if (cumulativeRules.length > 0 && !provider) {
      throw new Error('Cumulative rules require a provider')
    }
    for (const [ruleIndex, rule] of cumulativeRules.entries()) {
      // extract the raw parameter chunk
      const callDataValue = Bytes.padRight(
        Bytes.fromHex(call.data).slice(Number(rule.offset), Number(rule.offset) + 32),
        32,
      )
      // apply mask
      let value: Bytes.Bytes = callDataValue.map((b, i) => b & rule.mask[i]!)
      if (Bytes.toBigInt(value) === 0n) continue

      // read on-chain "used so far"
      const currentUsage = await this.getCurrentUsageLimit(wallet, sessionManagerAddress, perm, ruleIndex, provider)
      increments.push({
        usageHash: currentUsage.usageHash,
        usageAmount: Bytes.toBigInt(Bytes.fromNumber(currentUsage.usageAmount + Bytes.toBigInt(value), { size: 32 })),
      })
    }
    return increments
  }
}
