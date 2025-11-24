import { Bytes, Hash } from 'ox';
import { hashConfiguration } from './config.js';
export function from(configuration, context) {
    const imageHash = configuration instanceof Uint8Array ? configuration : hashConfiguration(configuration);
    return Bytes.toHex(Hash.keccak256(Bytes.concat(Bytes.from('0xff'), Bytes.from(context.factory), imageHash, Hash.keccak256(Bytes.concat(Bytes.from(context.creationCode), Bytes.padLeft(Bytes.from(context.stage1), 32)))), { as: 'Bytes' }).subarray(12));
}
//# sourceMappingURL=address.js.map