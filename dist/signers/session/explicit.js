import { Constants, Permission, SessionConfig, SessionSignature, } from '@0xsequence/wallet-primitives';
import { AbiFunction, AbiParameters, Address, Bytes, Hash, Hex } from 'ox';
import { MemoryPkStore } from '../pk/index.js';
const VALUE_TRACKING_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export class Explicit {
    _privateKey;
    address;
    sessionPermissions;
    constructor(privateKey, sessionPermissions) {
        this._privateKey = typeof privateKey === 'string' ? new MemoryPkStore(privateKey) : privateKey;
        this.address = this._privateKey.address();
        this.sessionPermissions = {
            ...sessionPermissions,
            signer: this.address,
        };
    }
    isValid(sessionTopology, chainId) {
        // Equality is considered expired
        if (this.sessionPermissions.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
            return { isValid: false, invalidReason: 'Expired' };
        }
        if (this.sessionPermissions.chainId !== 0 && this.sessionPermissions.chainId !== chainId) {
            return { isValid: false, invalidReason: 'Chain ID mismatch' };
        }
        const explicitPermission = SessionConfig.getSessionPermissions(sessionTopology, this.address);
        if (!explicitPermission) {
            return { isValid: false, invalidReason: 'Permission not found' };
        }
        // Validate permission in configuration matches permission in signer
        if (explicitPermission.deadline !== this.sessionPermissions.deadline ||
            explicitPermission.chainId !== this.sessionPermissions.chainId ||
            explicitPermission.valueLimit !== this.sessionPermissions.valueLimit ||
            explicitPermission.permissions.length !== this.sessionPermissions.permissions.length) {
            return { isValid: false, invalidReason: 'Permission mismatch' };
        }
        // Validate permission rules
        for (const [index, permission] of explicitPermission.permissions.entries()) {
            const signerPermission = this.sessionPermissions.permissions[index];
            if (!Address.isEqual(permission.target, signerPermission.target) ||
                permission.rules.length !== signerPermission.rules.length) {
                return { isValid: false, invalidReason: 'Permission rule mismatch' };
            }
            for (const [ruleIndex, rule] of permission.rules.entries()) {
                const signerRule = signerPermission.rules[ruleIndex];
                if (rule.cumulative !== signerRule.cumulative ||
                    rule.operation !== signerRule.operation ||
                    !Bytes.isEqual(rule.value, signerRule.value) ||
                    rule.offset !== signerRule.offset ||
                    !Bytes.isEqual(rule.mask, signerRule.mask)) {
                    return { isValid: false, invalidReason: 'Permission rule mismatch' };
                }
            }
        }
        return { isValid: true };
    }
    async findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider) {
        if (this.sessionPermissions.chainId !== 0 && this.sessionPermissions.chainId !== chainId) {
            return undefined;
        }
        if (call.value !== 0n) {
            // Validate the value
            if (!provider) {
                throw new Error('Value transaction validation requires a provider');
            }
            const usageHash = Hash.keccak256(AbiParameters.encode([
                { type: 'address', name: 'signer' },
                { type: 'address', name: 'valueTrackingAddress' },
            ], [this.address, VALUE_TRACKING_ADDRESS]));
            const { usageAmount } = await this.readCurrentUsageLimit(wallet, sessionManagerAddress, usageHash, provider);
            const value = Bytes.fromNumber(usageAmount + call.value, { size: 32 });
            if (Bytes.toBigInt(value) > this.sessionPermissions.valueLimit) {
                return undefined;
            }
        }
        for (const permission of this.sessionPermissions.permissions) {
            // Validate the permission
            if (await this.validatePermission(permission, call, wallet, sessionManagerAddress, provider)) {
                return permission;
            }
        }
        return undefined;
    }
    getPermissionUsageHash(permission, ruleIndex) {
        const encodedPermission = {
            target: permission.target,
            rules: permission.rules.map((rule) => ({
                cumulative: rule.cumulative,
                operation: rule.operation,
                value: Bytes.toHex(rule.value),
                offset: rule.offset,
                mask: Bytes.toHex(rule.mask),
            })),
        };
        return Hash.keccak256(AbiParameters.encode([{ type: 'address', name: 'signer' }, Permission.permissionStructAbi, { type: 'uint256', name: 'ruleIndex' }], [this.address, encodedPermission, BigInt(ruleIndex)]));
    }
    getValueUsageHash() {
        return Hash.keccak256(AbiParameters.encode([
            { type: 'address', name: 'signer' },
            { type: 'address', name: 'valueTrackingAddress' },
        ], [this.address, VALUE_TRACKING_ADDRESS]));
    }
    async validatePermission(permission, call, wallet, sessionManagerAddress, provider) {
        if (!Address.isEqual(permission.target, call.to)) {
            return false;
        }
        for (const [ruleIndex, rule] of permission.rules.entries()) {
            // Extract value from calldata at offset
            const callDataValue = Bytes.padRight(Bytes.fromHex(call.data).slice(Number(rule.offset), Number(rule.offset) + 32), 32);
            // Apply mask
            let value = callDataValue.map((b, i) => b & rule.mask[i]);
            if (rule.cumulative) {
                if (provider) {
                    const { usageAmount } = await this.readCurrentUsageLimit(wallet, sessionManagerAddress, this.getPermissionUsageHash(permission, ruleIndex), provider);
                    // Increment the value
                    value = Bytes.fromNumber(usageAmount + Bytes.toBigInt(value), { size: 32 });
                }
                else {
                    throw new Error('Cumulative rules require a provider');
                }
            }
            // Compare based on operation
            if (rule.operation === Permission.ParameterOperation.EQUAL) {
                if (!Bytes.isEqual(value, rule.value)) {
                    return false;
                }
            }
            if (rule.operation === Permission.ParameterOperation.LESS_THAN_OR_EQUAL) {
                if (Bytes.toBigInt(value) > Bytes.toBigInt(rule.value)) {
                    return false;
                }
            }
            if (rule.operation === Permission.ParameterOperation.NOT_EQUAL) {
                if (Bytes.isEqual(value, rule.value)) {
                    return false;
                }
            }
            if (rule.operation === Permission.ParameterOperation.GREATER_THAN_OR_EQUAL) {
                if (Bytes.toBigInt(value) < Bytes.toBigInt(rule.value)) {
                    return false;
                }
            }
        }
        return true;
    }
    async supportedCall(wallet, chainId, call, sessionManagerAddress, provider) {
        if (Address.isEqual(call.to, sessionManagerAddress) &&
            Hex.size(call.data) > 4 &&
            Hex.isEqual(Hex.slice(call.data, 0, 4), AbiFunction.getSelector(Constants.INCREMENT_USAGE_LIMIT))) {
            // Can sign increment usage calls
            return true;
        }
        const permission = await this.findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider);
        if (!permission) {
            return false;
        }
        return true;
    }
    async signCall(wallet, chainId, payload, callIdx, sessionManagerAddress, provider) {
        const call = payload.calls[callIdx];
        let permissionIndex;
        if (Address.isEqual(call.to, sessionManagerAddress) &&
            Hex.size(call.data) > 4 &&
            Hex.isEqual(Hex.slice(call.data, 0, 4), AbiFunction.getSelector(Constants.INCREMENT_USAGE_LIMIT))) {
            // Permission check not required. Use the first permission
            permissionIndex = 0;
        }
        else {
            // Find the valid permission for this call
            const permission = await this.findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider);
            if (!permission) {
                // This covers the support check
                throw new Error('Invalid permission');
            }
            permissionIndex = this.sessionPermissions.permissions.indexOf(permission);
            if (permissionIndex === -1) {
                // Unreachable
                throw new Error('Invalid permission');
            }
        }
        // Sign it
        const callHash = SessionSignature.hashPayloadWithCallIdx(wallet, payload, callIdx, chainId, sessionManagerAddress);
        const sessionSignature = await this._privateKey.signDigest(Bytes.fromHex(callHash));
        return {
            permissionIndex: BigInt(permissionIndex),
            sessionSignature,
        };
    }
    async readCurrentUsageLimit(wallet, sessionManagerAddress, usageHash, provider) {
        const readData = AbiFunction.encodeData(Constants.GET_LIMIT_USAGE, [wallet, usageHash]);
        const getUsageLimitResult = await provider.request({
            method: 'eth_call',
            params: [
                {
                    to: sessionManagerAddress,
                    data: readData,
                },
                'latest',
            ],
        });
        const usageAmount = AbiFunction.decodeResult(Constants.GET_LIMIT_USAGE, getUsageLimitResult);
        return {
            usageHash,
            usageAmount,
        };
    }
    async prepareIncrements(wallet, chainId, calls, sessionManagerAddress, provider) {
        const increments = [];
        const usageValueHash = this.getValueUsageHash();
        // Always read the current value usage
        const currentUsage = await this.readCurrentUsageLimit(wallet, sessionManagerAddress, usageValueHash, provider);
        let valueUsed = currentUsage.usageAmount;
        for (const call of calls) {
            // Find matching permission
            const perm = await this.findSupportedPermission(wallet, chainId, call, sessionManagerAddress, provider);
            if (!perm)
                continue;
            for (const [ruleIndex, rule] of perm.rules.entries()) {
                if (!rule.cumulative) {
                    continue;
                }
                // Extract the masked value
                const callDataValue = Bytes.padRight(Bytes.fromHex(call.data).slice(Number(rule.offset), Number(rule.offset) + 32), 32);
                let value = callDataValue.map((b, i) => b & rule.mask[i]);
                if (Bytes.toBigInt(value) === 0n)
                    continue;
                // Add to list
                const usageHash = this.getPermissionUsageHash(perm, ruleIndex);
                const existingIncrement = increments.find((i) => Hex.isEqual(i.usageHash, usageHash));
                if (existingIncrement) {
                    existingIncrement.increment += Bytes.toBigInt(value);
                }
                else {
                    increments.push({
                        usageHash,
                        increment: Bytes.toBigInt(value),
                    });
                }
            }
            valueUsed += call.value;
        }
        // If no increments, return early
        if (increments.length === 0 && valueUsed === 0n) {
            return [];
        }
        // Apply current usage limit to each increment
        const updatedIncrements = await Promise.all(increments.map(async ({ usageHash, increment }) => {
            if (increment === 0n)
                return null;
            const currentUsage = await this.readCurrentUsageLimit(wallet, sessionManagerAddress, usageHash, provider);
            // For value usage hash, validate against the limit
            if (Hex.isEqual(usageHash, usageValueHash)) {
                const totalValue = currentUsage.usageAmount + increment;
                if (totalValue > this.sessionPermissions.valueLimit) {
                    throw new Error('Value transaction validation failed');
                }
            }
            return {
                usageHash,
                usageAmount: currentUsage.usageAmount + increment,
            };
        })).then((results) => results.filter((r) => r !== null));
        // Finally, add the value usage if it's non-zero
        if (valueUsed > 0n) {
            updatedIncrements.push({
                usageHash: usageValueHash,
                usageAmount: valueUsed,
            });
        }
        return updatedIncrements;
    }
}
