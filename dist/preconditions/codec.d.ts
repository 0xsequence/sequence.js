import { Precondition } from './types.js';
export interface IntentPrecondition {
    type: string;
    data: string;
}
export declare function decodePreconditions(preconditions: IntentPrecondition[]): Precondition[];
export declare function decodePrecondition(p: IntentPrecondition): Precondition | undefined;
export declare function encodePrecondition(p: Precondition): string;
//# sourceMappingURL=codec.d.ts.map