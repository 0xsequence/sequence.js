import { CommandModule } from 'yargs';
export declare function doEmptyTopology(identitySigner: `0x${string}`): Promise<string>;
export declare function doEncodeTopology(sessionTopologyInput: string): Promise<string>;
export declare function doEncodeSessionCallSignatures(sessionTopologyInput: string, callSignaturesInput: string[], explicitSigners?: string[], implicitSigners?: string[]): Promise<string>;
export declare function doImageHash(sessionTopologyInput: string): Promise<string>;
declare const sessionCommand: CommandModule;
export default sessionCommand;
//# sourceMappingURL=session.d.ts.map