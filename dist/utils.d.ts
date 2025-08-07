import { Bytes } from 'ox';
export declare function minBytesFor(val: bigint): number;
export declare function packRSY({ r, s, yParity }: {
    r: bigint;
    s: bigint;
    yParity: number;
}): Bytes.Bytes;
export declare function unpackRSY(rsy: Bytes.Bytes): {
    r: bigint;
    s: bigint;
    yParity: number;
};
/**
 * Creates a replacer function for JSON.stringify that handles BigInt and Uint8Array serialization
 * Converts BigInt values to objects with format { __bigint: "0x..." }
 * Converts Uint8Array values to objects with format { __uint8array: [...] }
 * @param customReplacer Optional custom replacer function to apply after BigInt/Uint8Array handling
 */
export declare function createJSONReplacer(customReplacer?: (key: string, value: any) => any): (key: string, value: any) => any;
/**
 * Creates a reviver function for JSON.parse that handles BigInt and Uint8Array deserialization
 * Converts objects with { __bigint: "0x..." } format back to BigInt
 * Converts objects with { __uint8array: [...] } format back to Uint8Array
 * @param customReviver Optional custom reviver function to apply after BigInt/Uint8Array handling
 */
export declare function createJSONReviver(customReviver?: (key: string, value: any) => any): (key: string, value: any) => any;
/**
 * Serializes data to JSON string with BigInt and Uint8Array support
 * Converts BigInt values to objects with format { __bigint: "0x..." }
 * Converts Uint8Array values to objects with format { __uint8array: [...] }
 * @param obj The object to serialize
 * @param space Adds indentation, white space, and line break characters to the return-value JSON text
 * @param replacer A function that transforms the results or an array of strings and numbers that acts as an approved list for selecting the object properties
 */
export declare function toJSON(obj: any, replacer?: (number | string)[] | null | ((this: any, key: string, value: any) => any), space?: string | number): string;
/**
 * Deserializes JSON string with BigInt and Uint8Array support
 * Converts objects with { __bigint: "0x..." } format back to BigInt
 * Converts objects with { __uint8array: [...] } format back to Uint8Array
 * @param text The string to parse as JSON
 * @param reviver A function that transforms the results
 */
export declare function fromJSON(text: string, reviver?: (this: any, key: string, value: any) => any): any;
//# sourceMappingURL=utils.d.ts.map