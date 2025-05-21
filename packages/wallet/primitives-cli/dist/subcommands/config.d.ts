import type { CommandModule } from 'yargs';
export declare const PossibleElements: {
    type: string;
    format: string;
    description: string;
}[];
export declare function createConfig(options: {
    threshold: string;
    checkpoint: string;
    from: string;
    content: string[];
    checkpointer?: string;
}): Promise<string>;
export declare function calculateImageHash(input: string): Promise<string>;
export declare function doEncode(input: string): Promise<string>;
declare const configCommand: CommandModule;
export default configCommand;
//# sourceMappingURL=config.d.ts.map