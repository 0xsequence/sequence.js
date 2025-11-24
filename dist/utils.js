import { Bytes } from 'ox';
export function minBytesFor(val) {
    return Math.ceil(val.toString(16).length / 2);
}
// ERC-2098
export function packRSY({ r, s, yParity }) {
    const rBytes = Bytes.padLeft(Bytes.fromNumber(r), 32);
    let sBytes = Bytes.padLeft(Bytes.fromNumber(s), 32);
    if (yParity % 2 === 1) {
        sBytes[0] |= 0x80;
    }
    return Bytes.concat(rBytes, sBytes);
}
export function unpackRSY(rsy) {
    const r = Bytes.toBigInt(rsy.slice(0, 32));
    const yParityAndS = rsy.slice(32, 64);
    const yParity = (yParityAndS[0] & 0x80) !== 0 ? 1 : 0;
    const sBytes = new Uint8Array(yParityAndS);
    sBytes[0] = sBytes[0] & 0x7f;
    const s = Bytes.toBigInt(sBytes);
    return { r, s, yParity };
}
/**
 * Creates a replacer function for JSON.stringify that handles BigInt and Uint8Array serialization
 * Converts BigInt values to objects with format { __bigint: "0x..." }
 * Converts Uint8Array values to objects with format { __uint8array: [...] }
 * @param customReplacer Optional custom replacer function to apply after BigInt/Uint8Array handling
 */
export function createJSONReplacer(customReplacer) {
    return (key, value) => {
        // Handle BigInt conversion first
        if (typeof value === 'bigint') {
            return {
                __bigint: '0x' + value.toString(16),
            };
        }
        // Handle Uint8Array conversion
        if (value instanceof Uint8Array) {
            return {
                __uint8array: Array.from(value),
            };
        }
        // Then apply custom replacer if provided
        return customReplacer ? customReplacer(key, value) : value;
    };
}
/**
 * Creates a reviver function for JSON.parse that handles BigInt and Uint8Array deserialization
 * Converts objects with { __bigint: "0x..." } format back to BigInt
 * Converts objects with { __uint8array: [...] } format back to Uint8Array
 * @param customReviver Optional custom reviver function to apply after BigInt/Uint8Array handling
 */
export function createJSONReviver(customReviver) {
    return (key, value) => {
        // Handle BigInt conversion
        if (value && typeof value === 'object' && '__bigint' in value && Object.keys(value).length === 1) {
            const hex = value.__bigint;
            if (typeof hex === 'string' && hex.startsWith('0x')) {
                return BigInt(hex);
            }
        }
        // Handle Uint8Array conversion
        if (value && typeof value === 'object' && '__uint8array' in value && Object.keys(value).length === 1) {
            const arr = value.__uint8array;
            if (Array.isArray(arr)) {
                return new Uint8Array(arr);
            }
        }
        // Then apply custom reviver if provided
        return customReviver ? customReviver(key, value) : value;
    };
}
/**
 * Serializes data to JSON string with BigInt and Uint8Array support
 * Converts BigInt values to objects with format { __bigint: "0x..." }
 * Converts Uint8Array values to objects with format { __uint8array: [...] }
 * @param obj The object to serialize
 * @param space Adds indentation, white space, and line break characters to the return-value JSON text
 * @param replacer A function that transforms the results or an array of strings and numbers that acts as an approved list for selecting the object properties
 */
export function toJSON(obj, replacer, space) {
    const finalReplacer = replacer instanceof Function ? createJSONReplacer(replacer) : createJSONReplacer();
    return JSON.stringify(obj, finalReplacer, space);
}
/**
 * Deserializes JSON string with BigInt and Uint8Array support
 * Converts objects with { __bigint: "0x..." } format back to BigInt
 * Converts objects with { __uint8array: [...] } format back to Uint8Array
 * @param text The string to parse as JSON
 * @param reviver A function that transforms the results
 */
export function fromJSON(text, reviver) {
    const finalReviver = reviver ? createJSONReviver(reviver) : createJSONReviver();
    return JSON.parse(text, finalReviver);
}
//# sourceMappingURL=utils.js.map