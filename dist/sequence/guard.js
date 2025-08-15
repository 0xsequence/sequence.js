import { Address, Hex, Signature, AbiParameters, TypedData } from 'ox';
import { Kinds } from './types/signer.js';
import { Payload } from '@0xsequence/wallet-primitives';
export class Guard {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    async sign(wallet, chainId, payload) {
        const digest = Payload.hash(wallet, chainId, payload);
        const typedData = Payload.toTyped(wallet, chainId, payload);
        const serialized = Hex.fromString(TypedData.serialize(typedData));
        const auxData = AbiParameters.encode(AbiParameters.from(['address', 'uint256', 'bytes', 'bytes']), [
            Address.from(wallet),
            chainId,
            serialized,
            '0x',
        ]);
        try {
            const res = await fetch(`${this.shared.sequence.guardUrl}/rpc/Guard/SignWith`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    signer: this.shared.sequence.guardAddress,
                    request: {
                        chainId: Number(chainId),
                        msg: Hex.fromBytes(digest),
                        auxData,
                    },
                }),
            });
            const { sig } = await res.json();
            const signature = Signature.fromHex(sig);
            return {
                type: 'hash',
                ...signature,
            };
        }
        catch (error) {
            console.error('Error signing with guard:', error);
            throw new Error('Error signing with guard');
        }
    }
    async witness(wallet) {
        const payload = Payload.fromMessage(Hex.fromString(JSON.stringify({
            action: 'consent-to-be-part-of-wallet',
            wallet,
            signer: this.shared.sequence.guardAddress,
            timestamp: Date.now(),
            extra: {
                signerKind: Kinds.Guard,
            },
        })));
        const signature = await this.sign(wallet, 0n, payload);
        await this.shared.sequence.stateProvider.saveWitnesses(wallet, 0n, payload, {
            type: 'unrecovered-signer',
            weight: 1n,
            signature,
        });
    }
}
