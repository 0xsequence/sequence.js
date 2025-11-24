import { Payload, Signature } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import { Reader } from './index.js';
import { SapientSigner, Signer } from '../signers/index.js';
export type WalletWithWitness<S extends Signer | SapientSigner> = {
    wallet: Address.Address;
    chainId: number;
    payload: Payload.Parented;
    signature: S extends SapientSigner ? Signature.SignatureOfSapientSignerLeaf : Signature.SignatureOfSignerLeaf;
};
export declare function getWalletsFor<S extends Signer | SapientSigner>(stateReader: Reader, signer: S): Promise<Array<WalletWithWitness<S>>>;
export declare function normalizeAddressKeys<T extends Record<string, unknown>>(obj: T): Record<Address.Address, T[keyof T]>;
//# sourceMappingURL=utils.d.ts.map