import { Address, Bytes } from 'ox';
export declare enum ParameterOperation {
    EQUAL = 0,
    NOT_EQUAL = 1,
    GREATER_THAN_OR_EQUAL = 2,
    LESS_THAN_OR_EQUAL = 3
}
export type ParameterRule = {
    cumulative: boolean;
    operation: ParameterOperation;
    value: Bytes.Bytes;
    offset: bigint;
    mask: Bytes.Bytes;
};
export type Permission = {
    target: Address.Address;
    rules: ParameterRule[];
};
export type SessionPermissions = {
    signer: Address.Address;
    chainId: number;
    valueLimit: bigint;
    deadline: bigint;
    permissions: Permission[];
};
export declare const MAX_PERMISSIONS_COUNT: number;
export declare const MAX_RULES_COUNT: number;
export declare const MASK: {
    SELECTOR: Bytes.Bytes;
    ADDRESS: Bytes.Bytes;
    BOOL: Bytes.Bytes;
    BYTES1: Bytes.Bytes;
    BYTES2: Bytes.Bytes;
    BYTES4: Bytes.Bytes;
    BYTES8: Bytes.Bytes;
    BYTES16: Bytes.Bytes;
    BYTES32: Bytes.Bytes;
    INT8: Bytes.Bytes;
    INT16: Bytes.Bytes;
    INT32: Bytes.Bytes;
    INT64: Bytes.Bytes;
    INT128: Bytes.Bytes;
    INT256: Bytes.Bytes;
    UINT8: Bytes.Bytes;
    UINT16: Bytes.Bytes;
    UINT32: Bytes.Bytes;
    UINT64: Bytes.Bytes;
    UINT128: Bytes.Bytes;
    UINT256: Bytes.Bytes;
};
export declare function encodeSessionPermissions(sessionPermissions: SessionPermissions): Bytes.Bytes;
export declare function encodePermission(permission: Permission): Bytes.Bytes;
export declare function decodeSessionPermissions(bytes: Bytes.Bytes): SessionPermissions;
export declare const permissionStructAbi: {
    readonly internalType: "struct Permission";
    readonly name: "permission";
    readonly type: "tuple";
    readonly components: readonly [{
        readonly internalType: "address";
        readonly name: "target";
        readonly type: "address";
    }, {
        readonly internalType: "struct ParameterRule[]";
        readonly name: "rules";
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly internalType: "bool";
            readonly name: "cumulative";
            readonly type: "bool";
        }, {
            readonly internalType: "enum ParameterOperation";
            readonly name: "operation";
            readonly type: "uint8";
        }, {
            readonly internalType: "bytes32";
            readonly name: "value";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "offset";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "mask";
            readonly type: "bytes32";
        }];
    }];
};
export declare function abiEncodePermission(permission: Permission): string;
export declare function sessionPermissionsToJson(sessionPermissions: SessionPermissions): string;
export declare function encodeSessionPermissionsForJson(sessionPermissions: SessionPermissions): any;
export declare function permissionToJson(permission: Permission): string;
export declare function parameterRuleToJson(rule: ParameterRule): string;
export declare function sessionPermissionsFromJson(json: string): SessionPermissions;
export declare function sessionPermissionsFromParsed(parsed: any): SessionPermissions;
export declare function permissionFromJson(json: string): Permission;
//# sourceMappingURL=permission.d.ts.map