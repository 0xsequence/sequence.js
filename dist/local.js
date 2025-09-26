import { Address, Secp256k1 } from 'ox';
export class Guard {
    privateKey;
    address;
    constructor(privateKey) {
        this.privateKey = privateKey;
        const publicKey = Secp256k1.getPublicKey({ privateKey: this.privateKey });
        this.address = Address.fromPublicKey(publicKey);
    }
    async signPayload(wallet, chainId, type, digest, message, signatures) {
        return Secp256k1.sign({ privateKey: this.privateKey, payload: digest });
    }
}
