import { Address, Bytes } from 'ox';
export type Attestation = {
    approvedSigner: Address.Address;
    identityType: Bytes.Bytes;
    issuerHash: Bytes.Bytes;
    audienceHash: Bytes.Bytes;
    applicationData: Bytes.Bytes;
    authData: AuthData;
};
export type AuthData = {
    redirectUrl: string;
    issuedAt: bigint;
};
export declare function encode(attestation: Attestation): Bytes.Bytes;
export declare function encodeAuthData(authData: AuthData): Bytes.Bytes;
export declare function decode(bytes: Bytes.Bytes): Attestation;
export declare function decodeAuthData(bytes: Bytes.Bytes): AuthData;
export declare function hash(attestation: Attestation): Bytes.Bytes;
export declare function toJson(attestation: Attestation, indent?: number): string;
export declare function encodeForJson(attestation: Attestation): any;
export declare function fromJson(json: string): Attestation;
export declare function fromParsed(parsed: any): Attestation;
export declare const ACCEPT_IMPLICIT_REQUEST_MAGIC_PREFIX: Bytes.Bytes;
export declare function generateImplicitRequestMagic(attestation: Attestation, wallet: Address.Address): Bytes.Bytes;
//# sourceMappingURL=attestation.d.ts.map