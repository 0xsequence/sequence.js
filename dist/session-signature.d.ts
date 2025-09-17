import { Address, Bytes, Hex } from 'ox';
import { Attestation } from './attestation.js';
import { SessionsTopology } from './session-config.js';
import { RSY } from './signature.js';
import { Payload } from './index.js';
export type ImplicitSessionCallSignature = {
    attestation: Attestation;
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
export declare function encodeSessionCallSignatures(callSignatures: SessionCallSignature[], topology: SessionsTopology, explicitSigners?: Address.Address[], implicitSigners?: Address.Address[]): Bytes.Bytes;
export declare function hashCallWithReplayProtection(payload: Payload.Calls, callIdx: number, chainId: number, skipCallIdx?: boolean): Hex.Hex;
//# sourceMappingURL=session-signature.d.ts.map