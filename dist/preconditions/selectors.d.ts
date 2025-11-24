import { Precondition, NativeBalancePrecondition, Erc20BalancePrecondition } from './types.js';
import { TransactionPrecondition } from './codec.js';
export declare function extractChainID(precondition: TransactionPrecondition): number | undefined;
export declare function extractSupportedPreconditions(preconditions: TransactionPrecondition[]): Precondition[];
export declare function extractNativeBalancePreconditions(preconditions: TransactionPrecondition[]): NativeBalancePrecondition[];
export declare function extractERC20BalancePreconditions(preconditions: TransactionPrecondition[]): Erc20BalancePrecondition[];
//# sourceMappingURL=selectors.d.ts.map