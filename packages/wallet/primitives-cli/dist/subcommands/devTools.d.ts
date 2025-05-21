import type { CommandModule } from 'yargs';
export interface RandomOptions {
    seededRandom?: () => number;
    minThresholdOnNested?: number;
    maxPermissions?: number;
    maxRules?: number;
    checkpointerMode?: 'no' | 'random' | 'yes';
}
export declare function createSeededRandom(seed: string): () => number;
export declare function doRandomConfig(maxDepth: number, options?: RandomOptions): Promise<string>;
export declare function doRandomSessionTopology(maxDepth: number, options?: RandomOptions): Promise<string>;
declare const command: CommandModule;
export default command;
//# sourceMappingURL=devTools.d.ts.map