import { Hex, Signature } from 'ox';
import * as Client from './client/guard.gen.js';
import * as Types from './types.js';
export class Guard {
    guard;
    address;
    constructor(hostname, address, fetch) {
        if (hostname && address) {
            this.guard = new Client.Guard(hostname, fetch ?? window.fetch);
        }
        this.address = address;
    }
    async signPayload(wallet, chainId, type, digest, message, signatures, token) {
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
                token,
            });
            Hex.assert(res.sig);
            return Signature.fromHex(res.sig);
        }
        catch (error) {
            if (error instanceof Client.RequiresTOTPError) {
                throw new Types.AuthRequiredError('TOTP');
            }
            if (error instanceof Client.RequiresPINError) {
                throw new Types.AuthRequiredError('PIN');
            }
            console.error(error);
            throw new Error('Error signing with guard');
        }
    }
}
