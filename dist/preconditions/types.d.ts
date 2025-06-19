import { Address } from 'ox';
export interface Precondition {
    type(): string;
    isValid(): Error | undefined;
}
export declare class NativeBalancePrecondition implements Precondition {
    readonly address: Address.Address;
    readonly min?: bigint | undefined;
    readonly max?: bigint | undefined;
    constructor(address: Address.Address, min?: bigint | undefined, max?: bigint | undefined);
    type(): string;
    isValid(): Error | undefined;
}
export declare class Erc20BalancePrecondition implements Precondition {
    readonly address: Address.Address;
    readonly token: Address.Address;
    readonly min?: bigint | undefined;
    readonly max?: bigint | undefined;
    constructor(address: Address.Address, token: Address.Address, min?: bigint | undefined, max?: bigint | undefined);
    type(): string;
    isValid(): Error | undefined;
}
export declare class Erc20ApprovalPrecondition implements Precondition {
    readonly address: Address.Address;
    readonly token: Address.Address;
    readonly operator: Address.Address;
    readonly min: bigint;
    constructor(address: Address.Address, token: Address.Address, operator: Address.Address, min: bigint);
    type(): string;
    isValid(): Error | undefined;
}
export declare class Erc721OwnershipPrecondition implements Precondition {
    readonly address: Address.Address;
    readonly token: Address.Address;
    readonly tokenId: bigint;
    readonly owned?: boolean | undefined;
    constructor(address: Address.Address, token: Address.Address, tokenId: bigint, owned?: boolean | undefined);
    type(): string;
    isValid(): Error | undefined;
}
export declare class Erc721ApprovalPrecondition implements Precondition {
    readonly address: Address.Address;
    readonly token: Address.Address;
    readonly tokenId: bigint;
    readonly operator: Address.Address;
    constructor(address: Address.Address, token: Address.Address, tokenId: bigint, operator: Address.Address);
    type(): string;
    isValid(): Error | undefined;
}
export declare class Erc1155BalancePrecondition implements Precondition {
    readonly address: Address.Address;
    readonly token: Address.Address;
    readonly tokenId: bigint;
    readonly min?: bigint | undefined;
    readonly max?: bigint | undefined;
    constructor(address: Address.Address, token: Address.Address, tokenId: bigint, min?: bigint | undefined, max?: bigint | undefined);
    type(): string;
    isValid(): Error | undefined;
}
export declare class Erc1155ApprovalPrecondition implements Precondition {
    readonly address: Address.Address;
    readonly token: Address.Address;
    readonly tokenId: bigint;
    readonly operator: Address.Address;
    readonly min: bigint;
    constructor(address: Address.Address, token: Address.Address, tokenId: bigint, operator: Address.Address, min: bigint);
    type(): string;
    isValid(): Error | undefined;
}
//# sourceMappingURL=types.d.ts.map