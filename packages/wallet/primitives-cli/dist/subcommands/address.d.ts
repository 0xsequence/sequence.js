import type { CommandModule } from 'yargs';
export declare function doCalculateAddress(options: {
    imageHash: string;
    factory: string;
    module: string;
    creationCode?: string;
}): Promise<string>;
declare const addressCommand: CommandModule;
export default addressCommand;
//# sourceMappingURL=address.d.ts.map