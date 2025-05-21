import { type CommandModule } from 'yargs';
export declare function doEncode(input: string, signatures: string[] | undefined, noChainId: boolean, checkpointerData?: string): Promise<string>;
export declare function doConcat(signatures: string[]): Promise<string>;
export declare function doDecode(signature: string): Promise<string>;
declare const signatureCommand: CommandModule;
export default signatureCommand;
//# sourceMappingURL=signature.d.ts.map