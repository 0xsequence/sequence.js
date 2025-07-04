import { Payload, Signature } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import { Reader } from './index.js';
import { SapientSigner, Signer } from '../signers/index.js';
export type WalletWithWitness<S extends Signer | SapientSigner> = {
    wallet: Address.Address;
    chainId: bigint;
    payload: Payload.Parented;
    signature: S extends SapientSigner ? Signature.SignatureOfSapientSignerLeaf : Signature.SignatureOfSignerLeaf;
};
export declare function getWalletsFor<S extends Signer | SapientSigner>(stateReader: Reader, signer: S): Promise<Array<WalletWithWitness<S>>>;
//# sourceMappingURL=utils.d.ts.map