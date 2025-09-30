import { Kinds } from '../types/index.js';
import { Payload } from '@0xsequence/wallet-primitives';
import { Hex } from 'ox';
export class RecoveryHandler {
    signatures;
    recovery;
    kind = Kinds.Recovery;
    constructor(signatures, recovery) {
        this.signatures = signatures;
        this.recovery = recovery;
    }
    onStatusChange(cb) {
        return this.recovery.onQueuedPayloadsUpdate(undefined, cb);
    }
    async status(address, imageHash, request) {
        const queued = await this.recovery.getQueuedRecoveryPayloads(request.wallet, request.envelope.chainId);
        // If there is no queued payload for this request then we are unavailable
        const requestHash = Hex.fromBytes(Payload.hash(request.envelope.wallet, request.envelope.chainId, request.envelope.payload));
        const found = queued.find((p) => p.payloadHash === requestHash);
        if (!found) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'no-recovery-payload-queued',
            };
        }
        if (!imageHash) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'no-image-hash',
            };
        }
        if (found.endTimestamp > Date.now() / 1000) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'timelock-not-met',
            };
        }
        try {
            const signature = await this.recovery.encodeRecoverySignature(imageHash, found.signer);
            return {
                address,
                handler: this,
                status: 'ready',
                handle: async () => {
                    this.signatures.addSignature(request.id, {
                        imageHash,
                        signature: {
                            address,
                            data: Hex.fromBytes(signature),
                            type: 'sapient_compact',
                        },
                    });
                    return true;
                },
            };
        }
        catch (e) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'failed-to-encode-recovery-signature',
            };
        }
    }
}
