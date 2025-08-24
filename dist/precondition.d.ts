export interface Precondition {
    type: string;
}
export interface NativeBalancePrecondition extends Precondition {
    type: 'native-balance';
    address: string;
    min?: bigint;
    max?: bigint;
}
export interface Erc20BalancePrecondition extends Precondition {
    type: 'erc20-balance';
    address: string;
    token: string;
    min?: bigint;
    max?: bigint;
}
export interface Erc20ApprovalPrecondition extends Precondition {
    type: 'erc20-approval';
    address: string;
    token: string;
    operator: string;
    min: bigint;
}
export interface Erc721OwnershipPrecondition extends Precondition {
    type: 'erc721-ownership';
    address: string;
    token: string;
    tokenId: bigint;
    owned?: boolean;
}
export interface Erc721ApprovalPrecondition extends Precondition {
    type: 'erc721-approval';
    address: string;
    token: string;
    tokenId: bigint;
    operator: string;
}
export interface Erc1155BalancePrecondition extends Precondition {
    type: 'erc1155-balance';
    address: string;
    token: string;
    tokenId: bigint;
    min?: bigint;
    max?: bigint;
}
export interface Erc1155ApprovalPrecondition extends Precondition {
    type: 'erc1155-approval';
    address: string;
    token: string;
    tokenId: bigint;
    operator: string;
    min: bigint;
}
export type AnyPrecondition = NativeBalancePrecondition | Erc20BalancePrecondition | Erc20ApprovalPrecondition | Erc721OwnershipPrecondition | Erc721ApprovalPrecondition | Erc1155BalancePrecondition | Erc1155ApprovalPrecondition;
export declare function isValidPreconditionType(type: string): type is AnyPrecondition['type'];
export declare function createPrecondition<T extends AnyPrecondition>(precondition: T): T;
export interface IntentPrecondition<T extends AnyPrecondition = AnyPrecondition> {
    type: T['type'];
    data: Omit<T, 'type'>;
    chainId?: number;
}
export declare function createIntentPrecondition<T extends AnyPrecondition>(precondition: T, chainId?: number): IntentPrecondition<T>;
//# sourceMappingURL=precondition.d.ts.map