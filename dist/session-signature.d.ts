import { Address, Bytes, Hex } from 'ox';
import { Attestation, Payload } from './index.js';
import { SessionsTopology } from './session-config.js';
import { RSY } from './signature.js';
export type ImplicitSessionCallSignature = {
    attestation: Attestation.Attestation;
    identitySignature: RSY;
    sessionSignature: RSY;
};
export type ExplicitSessionCallSignature = {
    permissionIndex: bigint;
    sessionSignature: RSY;
};
export type SessionCallSignature = ImplicitSessionCallSignature | ExplicitSessionCallSignature;
export declare function isImplicitSessionCallSignature(callSignature: SessionCallSignature): callSignature is ImplicitSessionCallSignature;
export declare function isExplicitSessionCallSignature(callSignature: SessionCallSignature): callSignature is ExplicitSessionCallSignature;
export declare function sessionCallSignatureToJson(callSignature: SessionCallSignature): string;
export declare function encodeSessionCallSignatureForJson(callSignature: SessionCallSignature): any;
export declare function sessionCallSignatureFromJson(json: string): SessionCallSignature;
export declare function sessionCallSignatureFromParsed(decoded: any): SessionCallSignature;
/**
 * Encodes a list of session call signatures into a bytes array for contract validation.
 * @param callSignatures The list of session call signatures to encode.
 * @param topology The complete session topology.
 * @param explicitSigners The list of explicit signers to encode. Others will be hashed into nodes.
 * @param implicitSigners The list of implicit signers to encode. Others will be hashed into nodes.
 * @param identitySigner  The identity signer to encode. Others will be hashed into nodes.
 * @returns The encoded session call signatures.
 */
export declare function encodeSessionSignature(callSignatures: SessionCallSignature[], topology: SessionsTopology, identitySigner: Address.Address, explicitSigners?: Address.Address[], implicitSigners?: Address.Address[]): Bytes.Bytes;
export declare function decodeSessionSignature(encodedSignatures: Bytes.Bytes): {
    topology: SessionsTopology;
    callSignatures: SessionCallSignature[];
};
/**
 * Hashes a call with replay protection parameters.
 * @param payload The payload to hash.
 * @param callIdx The index of the call to hash.
 * @param chainId The chain ID. Use 0 when noChainId enabled.
 * @param sessionManagerAddress The session manager address to compile the hash for. Only required to support deprecated hash encodings for Dev1, Dev2 and Rc3.
 * @returns The hash of the call with replay protection parameters for sessions.
 */
export declare function hashPayloadWithCallIdx(wallet: Address.Address, payload: Payload.Calls & Payload.Parent, callIdx: number, chainId: number, sessionManagerAddress?: Address.Address): Hex.Hex;
//# sourceMappingURL=session-signature.d.ts.map