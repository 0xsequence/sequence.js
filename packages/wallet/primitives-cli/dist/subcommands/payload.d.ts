import type { CommandModule } from 'yargs';
export declare const DecodedAbi: ({
    type: string;
    name: string;
    components?: undefined;
} | {
    type: string;
    name: string;
    components: {
        type: string;
        name: string;
    }[];
})[];
export declare function doConvertToAbi(_payload: string): Promise<string>;
export declare function doConvertToPacked(payload: string, wallet?: string): Promise<string>;
export declare function doConvertToJson(payload: string): Promise<string>;
export declare function doHash(wallet: string, chainId: bigint, payload: string): Promise<string>;
declare const payloadCommand: CommandModule;
export default payloadCommand;
//# sourceMappingURL=payload.d.ts.map