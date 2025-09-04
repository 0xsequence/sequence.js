import { Address, Bytes } from 'ox';
import { Signers, State } from '@0xsequence/wallet-core';
import { IdentityInstrument } from '@0xsequence/identity-instrument';
import { AuthKey } from '../dbs/auth-keys.js';
import { Payload, Signature as SequenceSignature } from '@0xsequence/wallet-primitives';
import * as Identity from '@0xsequence/identity-instrument';
export declare function toIdentityAuthKey(authKey: AuthKey): Identity.AuthKey;
export declare class IdentitySigner implements Signers.Signer {
    readonly identityInstrument: IdentityInstrument;
    readonly authKey: AuthKey;
    constructor(identityInstrument: IdentityInstrument, authKey: AuthKey);
    get address(): Address.Address;
    sign(wallet: Address.Address, chainId: number, payload: Payload.Parented): Promise<SequenceSignature.SignatureOfSignerLeaf>;
    signDigest(digest: Bytes.Bytes): Promise<SequenceSignature.SignatureOfSignerLeafHash>;
    witness(stateWriter: State.Writer, wallet: Address.Address, extra?: Object): Promise<void>;
}
//# sourceMappingURL=signer.d.ts.map