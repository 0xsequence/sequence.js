import { Signatures } from '../signatures.js';
import { Address, Hex } from 'ox';
import { Devices } from '../devices.js';
import { Handler } from './handler.js';
import { SignerReady, SignerUnavailable, BaseSignatureRequest } from '../types/index.js';
export declare class DevicesHandler implements Handler {
    private readonly signatures;
    private readonly devices;
    kind: "local-device";
    constructor(signatures: Signatures, devices: Devices);
    onStatusChange(cb: () => void): () => void;
    status(address: Address.Address, _imageHash: Hex.Hex | undefined, request: BaseSignatureRequest): Promise<SignerUnavailable | SignerReady>;
}
//# sourceMappingURL=devices.d.ts.map