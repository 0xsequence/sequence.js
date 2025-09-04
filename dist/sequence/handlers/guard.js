import { Kinds } from '../types/index.js';
export class GuardHandler {
    signatures;
    guard;
    kind = Kinds.Guard;
    constructor(signatures, guard) {
        this.signatures = signatures;
        this.guard = guard;
    }
    onStatusChange(cb) {
        return () => { };
    }
    async status(address, _imageHash, request) {
        if (request.envelope.signatures.length === 0) {
            return {
                address,
                handler: this,
                status: 'unavailable',
                reason: 'must-not-sign-first',
            };
        }
        // TODO: check if 2FA is required. If it is, return 'actionable'
        return {
            address,
            handler: this,
            status: 'ready',
            handle: async () => {
                const signature = await this.guard.signEnvelope(request.envelope);
                await this.signatures.addSignature(request.id, signature);
                return true;
            },
        };
    }
}
