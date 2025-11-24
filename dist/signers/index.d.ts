import { Config, Payload, Signature } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import * as State from '../state/index.js';
export * as Pk from './pk/index.js';
export * as Passkey from './passkey.js';
export * as Session from './session/index.js';
export * from './session-manager.js';
export * from './guard.js';
export interface Signer {
    readonly address: MaybePromise<Address.Address>;
    sign: (wallet: Address.Address, chainId: number, payload: Payload.Parented) => Config.SignerSignature<Signature.SignatureOfSignerLeaf>;
}
export interface SapientSigner {
    readonly address: MaybePromise<Address.Address>;
    readonly imageHash: MaybePromise<Hex.Hex | undefined>;
    signSapient: (wallet: Address.Address, chainId: number, payload: Payload.Parented, imageHash: Hex.Hex) => Config.SignerSignature<Signature.SignatureOfSapientSignerLeaf>;
}
export interface Witnessable {
    witness: (stateWriter: State.Writer, wallet: Address.Address, extra?: Object) => Promise<void>;
}
type MaybePromise<T> = T | Promise<T>;
export declare function isSapientSigner(signer: Signer | SapientSigner): signer is SapientSigner;
export declare function isSigner(signer: Signer | SapientSigner): signer is Signer;
//# sourceMappingURL=index.d.ts.map