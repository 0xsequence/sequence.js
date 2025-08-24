import { Hex, Address } from 'ox';
import { Payload, Extensions } from '@0xsequence/wallet-primitives';
import type { Signature as SignatureTypes } from '@0xsequence/wallet-primitives';
import { State } from '../index.js';
import { SapientSigner, Witnessable } from './index.js';
export type PasskeyOptions = {
    extensions: Pick<Extensions.Extensions, 'passkeys'>;
    publicKey: Extensions.Passkeys.PublicKey;
    credentialId: string;
    embedMetadata?: boolean;
    metadata?: Extensions.Passkeys.PasskeyMetadata;
};
export type CreatePasskeyOptions = {
    stateProvider?: State.Provider;
    requireUserVerification?: boolean;
    credentialName?: string;
    embedMetadata?: boolean;
};
export type WitnessMessage = {
    action: 'consent-to-be-part-of-wallet';
    wallet: Address.Address;
    publicKey: Extensions.Passkeys.PublicKey;
    timestamp: number;
    metadata?: Extensions.Passkeys.PasskeyMetadata;
};
export declare function isWitnessMessage(message: unknown): message is WitnessMessage;
export declare class Passkey implements SapientSigner, Witnessable {
    readonly credentialId: string;
    readonly publicKey: Extensions.Passkeys.PublicKey;
    readonly address: Address.Address;
    readonly imageHash: Hex.Hex;
    readonly embedMetadata: boolean;
    readonly metadata?: Extensions.Passkeys.PasskeyMetadata;
    constructor(options: PasskeyOptions);
    static loadFromWitness(stateReader: State.Reader, extensions: Pick<Extensions.Extensions, 'passkeys'>, wallet: Address.Address, imageHash: Hex.Hex): Promise<Passkey>;
    static create(extensions: Pick<Extensions.Extensions, 'passkeys'>, options?: CreatePasskeyOptions): Promise<Passkey>;
    static find(stateReader: State.Reader, extensions: Pick<Extensions.Extensions, 'passkeys'>): Promise<Passkey | undefined>;
    signSapient(wallet: Address.Address, chainId: number, payload: Payload.Parented, imageHash: Hex.Hex): Promise<SignatureTypes.SignatureOfSapientSignerLeaf>;
    witness(stateWriter: State.Writer, wallet: Address.Address, extra?: Object): Promise<void>;
}
//# sourceMappingURL=passkey.d.ts.map