import { Hex, Signature } from 'ox';
import * as Client from './client/guard.gen.js';
export class Guard {
    guard;
    address;
    constructor(hostname, address, fetch) {
        if (hostname && address) {
            this.guard = new Client.Guard(hostname, fetch ?? window.fetch);
        }
        this.address = address;
    }
    async signPayload(wallet, chainId, type, digest, message, signatures) {
        if (!this.guard || !this.address) {
            throw new Error('Guard not initialized');
        }
        try {
            const res = await this.guard.signWith({
                signer: this.address,
                request: {
                    chainId: chainId,
                    msg: Hex.fromBytes(digest),
                    wallet,
                    payloadType: type,
                    payloadData: Hex.fromBytes(message),
                    signatures,
                },
            });
            Hex.assert(res.sig);
            return Signature.fromHex(res.sig);
        }
        catch (error) {
            console.error(error);
            throw new Error('Error signing with guard');
        }
    }
}
