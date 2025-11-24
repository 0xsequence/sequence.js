import { AbiParameters, Address, Bytes } from 'ox';
export var ParameterOperation;
(function (ParameterOperation) {
    ParameterOperation[ParameterOperation["EQUAL"] = 0] = "EQUAL";
    ParameterOperation[ParameterOperation["NOT_EQUAL"] = 1] = "NOT_EQUAL";
    ParameterOperation[ParameterOperation["GREATER_THAN_OR_EQUAL"] = 2] = "GREATER_THAN_OR_EQUAL";
    ParameterOperation[ParameterOperation["LESS_THAN_OR_EQUAL"] = 3] = "LESS_THAN_OR_EQUAL";
})(ParameterOperation || (ParameterOperation = {}));
export const MAX_PERMISSIONS_COUNT = 2 ** 7 - 1;
export const MAX_RULES_COUNT = 2 ** 8 - 1;
export const MASK = {
    SELECTOR: Bytes.padRight(Bytes.fromHex('0xffffffff'), 32), // Select intentionally pads right. Other values should pad left
    ADDRESS: Bytes.padLeft(Bytes.fromHex('0xffffffffffffffffffffffffffffffffffffffff'), 32),
    BOOL: Bytes.padLeft(Bytes.fromHex('0x01'), 32),
    // Bytes
    BYTES1: Bytes.padLeft(Bytes.from(Array(1).fill(0xff)), 32),
    BYTES2: Bytes.padLeft(Bytes.from(Array(2).fill(0xff)), 32),
    BYTES4: Bytes.padLeft(Bytes.from(Array(4).fill(0xff)), 32),
    BYTES8: Bytes.padLeft(Bytes.from(Array(8).fill(0xff)), 32),
    BYTES16: Bytes.padLeft(Bytes.from(Array(16).fill(0xff)), 32),
    BYTES32: Bytes.padLeft(Bytes.from(Array(32).fill(0xff)), 32),
    // Ints
    INT8: Bytes.padLeft(Bytes.from(Array(1).fill(0xff)), 32),
    INT16: Bytes.padLeft(Bytes.from(Array(2).fill(0xff)), 32),
    INT32: Bytes.padLeft(Bytes.from(Array(4).fill(0xff)), 32),
    INT64: Bytes.padLeft(Bytes.from(Array(8).fill(0xff)), 32),
    INT128: Bytes.padLeft(Bytes.from(Array(16).fill(0xff)), 32),
    INT256: Bytes.padLeft(Bytes.from(Array(32).fill(0xff)), 32),
    // Uints
    UINT8: Bytes.padLeft(Bytes.from(Array(1).fill(0xff)), 32),
    UINT16: Bytes.padLeft(Bytes.from(Array(2).fill(0xff)), 32),
    UINT32: Bytes.padLeft(Bytes.from(Array(4).fill(0xff)), 32),
    UINT64: Bytes.padLeft(Bytes.from(Array(8).fill(0xff)), 32),
    UINT128: Bytes.padLeft(Bytes.from(Array(16).fill(0xff)), 32),
    UINT256: Bytes.padLeft(Bytes.from(Array(32).fill(0xff)), 32),
};
// Encoding
export function encodeSessionPermissions(sessionPermissions) {
    if (sessionPermissions.permissions.length > MAX_PERMISSIONS_COUNT) {
        throw new Error('Too many permissions');
    }
    const encodedPermissions = sessionPermissions.permissions.map(encodePermission);
    return Bytes.concat(Bytes.padLeft(Bytes.fromHex(sessionPermissions.signer), 20), Bytes.padLeft(Bytes.fromNumber(sessionPermissions.chainId), 32), Bytes.padLeft(Bytes.fromNumber(sessionPermissions.valueLimit), 32), Bytes.padLeft(Bytes.fromNumber(sessionPermissions.deadline, { size: 8 }), 8), Bytes.fromNumber(sessionPermissions.permissions.length, { size: 1 }), Bytes.concat(...encodedPermissions));
}
export function encodePermission(permission) {
    if (permission.rules.length > MAX_RULES_COUNT) {
        throw new Error('Too many rules');
    }
    const encodedRules = permission.rules.map(encodeParameterRule);
    return Bytes.concat(Bytes.padLeft(Bytes.fromHex(permission.target), 20), Bytes.fromNumber(permission.rules.length, { size: 1 }), Bytes.concat(...encodedRules));
}
function encodeParameterRule(rule) {
    // Combine operation and cumulative flag into a single byte
    // 0x[operationx3][cumulative]
    const operationCumulative = (Number(rule.operation) << 1) | (rule.cumulative ? 1 : 0);
    return Bytes.concat(Bytes.fromNumber(operationCumulative), Bytes.padLeft(rule.value, 32), Bytes.padLeft(Bytes.fromNumber(rule.offset), 32), Bytes.padLeft(rule.mask, 32));
}
// Decoding
export function decodeSessionPermissions(bytes) {
    const signer = Bytes.toHex(bytes.slice(0, 20));
    const chainId = Bytes.toNumber(bytes.slice(20, 52));
    const valueLimit = Bytes.toBigInt(bytes.slice(52, 84));
    const deadline = Bytes.toBigInt(bytes.slice(84, 92));
    const permissionsLength = Number(bytes[92]);
    const permissions = [];
    let pointer = 93;
    for (let i = 0; i < permissionsLength; i++) {
        // Pass the remaining bytes instead of a fixed slice length
        const { permission, consumed } = decodePermission(bytes.slice(pointer));
        permissions.push(permission);
        pointer += consumed;
    }
    if (permissions.length === 0) {
        throw new Error('No permissions');
    }
    return {
        signer,
        chainId,
        valueLimit,
        deadline,
        permissions: permissions,
    };
}
// Returns the permission and the number of bytes consumed in the permission block
function decodePermission(bytes) {
    const target = Bytes.toHex(bytes.slice(0, 20));
    const rulesLength = Number(bytes[20]);
    const rules = [];
    let pointer = 21;
    for (let i = 0; i < rulesLength; i++) {
        const ruleBytes = bytes.slice(pointer, pointer + 97);
        rules.push(decodeParameterRule(ruleBytes));
        pointer += 97;
    }
    return {
        permission: {
            target,
            rules,
        },
        consumed: pointer,
    };
}
function decodeParameterRule(bytes) {
    const operationCumulative = Number(bytes[0]);
    const cumulative = (operationCumulative & 1) === 1;
    const operation = operationCumulative >> 1;
    const value = bytes.slice(1, 33);
    const offset = Bytes.toBigInt(bytes.slice(33, 65));
    const mask = bytes.slice(65, 97);
    return {
        cumulative,
        operation,
        value,
        offset,
        mask,
    };
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
};
export function abiEncodePermission(permission) {
    return AbiParameters.encode([permissionStructAbi], [
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
    ]);
}
// JSON
export function sessionPermissionsToJson(sessionPermissions) {
    return JSON.stringify(encodeSessionPermissionsForJson(sessionPermissions));
}
export function encodeSessionPermissionsForJson(sessionPermissions) {
    return {
        signer: sessionPermissions.signer.toString(),
        chainId: sessionPermissions.chainId.toString(),
        valueLimit: sessionPermissions.valueLimit.toString(),
        deadline: sessionPermissions.deadline.toString(),
        permissions: sessionPermissions.permissions.map(encodePermissionForJson),
    };
}
export function permissionToJson(permission) {
    return JSON.stringify(encodePermissionForJson(permission));
}
function encodePermissionForJson(permission) {
    return {
        target: permission.target.toString(),
        rules: permission.rules.map(encodeParameterRuleForJson),
    };
}
export function parameterRuleToJson(rule) {
    return JSON.stringify(encodeParameterRuleForJson(rule));
}
function encodeParameterRuleForJson(rule) {
    return {
        cumulative: rule.cumulative,
        operation: rule.operation,
        value: Bytes.toHex(rule.value),
        offset: rule.offset.toString(),
        mask: Bytes.toHex(rule.mask),
    };
}
export function sessionPermissionsFromJson(json) {
    return sessionPermissionsFromParsed(JSON.parse(json));
}
export function sessionPermissionsFromParsed(parsed) {
    return {
        signer: Address.from(parsed.signer),
        chainId: Number(parsed.chainId),
        valueLimit: BigInt(parsed.valueLimit),
        deadline: BigInt(parsed.deadline),
        permissions: parsed.permissions.map(permissionFromParsed),
    };
}
export function permissionFromJson(json) {
    return permissionFromParsed(JSON.parse(json));
}
function permissionFromParsed(parsed) {
    return {
        target: Address.from(parsed.target),
        rules: parsed.rules.map((decoded) => ({
            cumulative: decoded.cumulative,
            operation: decoded.operation,
            value: Bytes.fromHex(decoded.value),
            offset: BigInt(decoded.offset),
            mask: Bytes.fromHex(decoded.mask),
        })),
    };
}
//# sourceMappingURL=permission.js.map