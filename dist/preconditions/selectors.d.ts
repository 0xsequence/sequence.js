import { Precondition, NativeBalancePrecondition, Erc20BalancePrecondition } from './types.js';
import { IntentPrecondition } from './codec.js';
export declare function extractChainID(precondition: IntentPrecondition): bigint | undefined;
export declare function extractSupportedPreconditions(preconditions: IntentPrecondition[]): Precondition[];
export declare function extractNativeBalancePreconditions(preconditions: IntentPrecondition[]): NativeBalancePrecondition[];
export declare function extractERC20BalancePreconditions(preconditions: IntentPrecondition[]): Erc20BalancePrecondition[];
//# sourceMappingURL=selectors.d.ts.map