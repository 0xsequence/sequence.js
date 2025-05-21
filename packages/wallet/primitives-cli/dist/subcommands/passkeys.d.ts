import type { CommandModule } from 'yargs';
export declare function doEncodeSignature(options: {
    x: string;
    y: string;
    requireUserVerification: boolean;
    credentialId?: string;
    metadataHash?: string;
    r: string;
    s: string;
    authenticatorData: string;
    clientDataJson: string | object;
    embedMetadata: boolean;
}): Promise<string>;
export declare function doDecodeSignature(encodedSignatureHex: string): Promise<string>;
export declare function doComputeRoot(options: {
    x: string;
    y: string;
    requireUserVerification: boolean;
    credentialId?: string;
    metadataHash?: string;
}): Promise<string>;
export declare function doValidateSignature(options: {
    challenge: string;
    x: string;
    y: string;
    requireUserVerification: boolean;
    credentialId?: string;
    metadataHash?: string;
    r: string;
    s: string;
    authenticatorData: string;
    clientDataJson: string;
}): Promise<boolean>;
declare const passkeysCommand: CommandModule;
export default passkeysCommand;
//# sourceMappingURL=passkeys.d.ts.map