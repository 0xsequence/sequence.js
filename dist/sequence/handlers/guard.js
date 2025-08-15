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
        // TODO: check if 2FA is required. If it is, return 'actionable'
        return {
            address,
            handler: this,
            status: 'ready',
            handle: async () => {
                const signature = await this.guard.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload);
                await this.signatures.addSignature(request.id, {
                    address,
                    signature,
                });
                return true;
            },
        };
    }
}
