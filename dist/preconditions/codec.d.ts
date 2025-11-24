import { Precondition } from './types.js';
export interface TransactionPrecondition {
    type: string;
    chainId: number;
    ownerAddress: string;
    tokenAddress: string;
    minAmount: bigint;
}
export declare function decodePreconditions(preconditions: TransactionPrecondition[]): Precondition[];
export declare function decodePrecondition(p: TransactionPrecondition): Precondition | undefined;
export declare function encodePrecondition(p: Precondition): string;
//# sourceMappingURL=codec.d.ts.map