import { CommandModule } from 'yargs';
import { Hex } from 'ox';
export declare function doHashFromLeaves(leavesInput: string | string[]): Promise<string>;
export declare function doEncode(leavesInput: string | string[]): Promise<string>;
export declare function doTrim(leavesInput: string | string[], signer: string): Promise<string>;
export declare function doHashEncoded(encodedStr: Hex.Hex): Promise<string>;
declare const recoveryCommand: CommandModule;
export default recoveryCommand;
//# sourceMappingURL=recovery.d.ts.map