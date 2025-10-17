import { Kinds } from '../types/signer.js';
export class DevicesHandler {
    signatures;
    devices;
    kind = Kinds.LocalDevice;
    constructor(signatures, devices) {
        this.signatures = signatures;
        this.devices = devices;
    }
    onStatusChange(cb) {
        return () => { };
    }
    async status(address, _imageHash, request) {
        const signer = await this.devices.get(address);
        if (!signer) {
            const status = {
                address,
                handler: this,
                reason: 'not-local-key',
                status: 'unavailable',
            };
            return status;
        }
        const status = {
            address,
            handler: this,
            status: 'ready',
            handle: async () => {
                const signature = await signer.sign(request.envelope.wallet, request.envelope.chainId, request.envelope.payload);
                await this.signatures.addSignature(request.id, {
                    address,
                    signature,
                });
                return true;
            },
        };
        return status;
    }
}
