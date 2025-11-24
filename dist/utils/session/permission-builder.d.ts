import { Permission } from '@0xsequence/wallet-primitives';
import { AbiFunction, Address, Bytes } from 'ox';
export declare class PermissionBuilder {
    private target;
    private rules;
    private fnTypes?;
    private fnNames?;
    private allowAllSet;
    private exactCalldataSet;
    private constructor();
    static for(target: Address.Address): PermissionBuilder;
    allowAll(): this;
    exactCalldata(calldata: Bytes.Bytes): this;
    forFunction(sig: string | AbiFunction.AbiFunction): this;
    private findOffset;
    private addRule;
    withUintNParam(param: string | number, value: bigint, bits?: 8 | 16 | 32 | 64 | 128 | 256, operation?: Permission.ParameterOperation, cumulative?: boolean): this;
    withIntNParam(param: string | number, value: bigint, bits?: 8 | 16 | 32 | 64 | 128 | 256, operation?: Permission.ParameterOperation, cumulative?: boolean): this;
    withBytesNParam(param: string | number, value: Bytes.Bytes, size?: 1 | 2 | 4 | 8 | 16 | 32, operation?: Permission.ParameterOperation, cumulative?: boolean): this;
    withAddressParam(param: string | number, value: Address.Address, operation?: Permission.ParameterOperation, cumulative?: boolean): this;
    withBoolParam(param: string | number, value: boolean, operation?: Permission.ParameterOperation, cumulative?: boolean): this;
    private withDynamicAtOffset;
    withBytesParam(param: string | number, value: Bytes.Bytes): this;
    withStringParam(param: string | number, text: string): this;
    onlyOnce(): this;
    build(): Permission.Permission;
}
/**
 * Builds permissions for an ERC20 token.
 */
export declare class ERC20PermissionBuilder {
    static buildTransfer(target: Address.Address, limit: bigint): Permission.Permission;
    static buildApprove(target: Address.Address, spender: Address.Address, limit: bigint): Permission.Permission;
}
/**
 * Builds permissions for an ERC721 token.
 */
export declare class ERC721PermissionBuilder {
    static buildTransfer(target: Address.Address, tokenId: bigint): Permission.Permission;
    static buildApprove(target: Address.Address, spender: Address.Address, tokenId: bigint): Permission.Permission;
}
/**
 * Builds permissions for an ERC1155 token.
 */
export declare class ERC1155PermissionBuilder {
    static buildTransfer(target: Address.Address, tokenId: bigint, limit: bigint): Permission.Permission;
    static buildApproveAll(target: Address.Address, operator: Address.Address): Permission.Permission;
}
//# sourceMappingURL=permission-builder.d.ts.map