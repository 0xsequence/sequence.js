/* eslint-disable @typescript-eslint/no-explicit-any */
import { allNetworks } from '@0xsequence/network';
import { Bytes, Hex } from 'ox';
import { NODES_URL, RELAYER_URL } from './constants.js';
/**
 * Creates a single JSON replacer by chaining multiple replacers.
 * The first replacer to transform a value wins.
 */
function chainReplacers(replacers) {
    return function (key, value) {
        for (const replacer of replacers) {
            const replacedValue = replacer(key, value);
            if (replacedValue !== value) {
                return replacedValue;
            }
        }
        return value;
    };
}
/**
 * Creates a single JSON reviver by chaining multiple revivers.
 * The output of one reviver becomes the input for the next.
 */
function chainRevivers(revivers) {
    return function (key, value) {
        let currentValue = value;
        for (const reviver of revivers) {
            currentValue = reviver(key, currentValue);
        }
        return currentValue;
    };
}
/**
 * A JSON replacer that serializes BigInt values into a structured object.
 */
const bigIntReplacer = (_key, value) => {
    if (typeof value === 'bigint') {
        return {
            _isBigInt: true,
            data: value.toString(),
        };
    }
    return value;
};
/**
 * A JSON replacer that serializes Uint8Array values into a structured object.
 */
const uint8ArrayReplacer = (_key, value) => {
    if (value instanceof Uint8Array) {
        return {
            _isUint8Array: true,
            data: Hex.from(value),
        };
    }
    return value;
};
/**
 * A JSON reviver that deserializes a structured object back into a BigInt.
 */
const bigIntReviver = (key, value) => {
    if (value !== null && typeof value === 'object' && value._isBigInt === true && typeof value.data === 'string') {
        try {
            return BigInt(value.data);
        }
        catch (e) {
            console.error(`Failed to revive BigInt for key "${key}":`, e);
            return value; // Return original object if revival fails
        }
    }
    return value;
};
/**
 * A JSON reviver that deserializes a structured object back into a Uint8Array.
 */
const uint8ArrayReviver = (key, value) => {
    if (value !== null && typeof value === 'object' && value._isUint8Array === true && typeof value.data === 'string') {
        try {
            return Bytes.from(value.data);
        }
        catch (e) {
            console.error(`Failed to revive Uint8Array for key "${key}":`, e);
            return value; // Return original object if revival fails
        }
    }
    return value;
};
export const jsonReplacers = chainReplacers([bigIntReplacer, uint8ArrayReplacer]);
export const jsonRevivers = chainRevivers([bigIntReviver, uint8ArrayReviver]);
/**
 * Apply a template to a string.
 *
 * Example:
 * applyTemplate('https://v3-{network}-relayer.sequence.app', { network: 'arbitrum' })
 * returns 'https://v3-arbitrum-relayer.sequence.app'
 *
 * @param template - The template to apply.
 * @param values - The values to apply to the template.
 * @returns The template with the values applied.
 */
function applyTemplate(template, values) {
    return template.replace(/{(.*?)}/g, (_, key) => {
        const value = values[key];
        if (value === undefined) {
            throw new Error(`Missing template value for ${template}: ${key}`);
        }
        return value;
    });
}
export const getNetwork = (chainId) => {
    const network = allNetworks.find((network) => network.chainId === chainId);
    if (!network) {
        throw new Error(`Network with chainId ${chainId} not found`);
    }
    return network;
};
export const getRpcUrl = (chainId) => {
    const network = getNetwork(chainId);
    const url = applyTemplate(NODES_URL, { network: network.name });
    return url;
};
export const getRelayerUrl = (chainId) => {
    const network = getNetwork(chainId);
    const url = applyTemplate(RELAYER_URL, { network: network.name });
    return url;
};
export const getExplorerUrl = (chainId, txHash) => {
    const network = getNetwork(chainId);
    const explorerUrl = network.blockExplorer?.rootUrl;
    if (!explorerUrl) {
        throw new Error(`Explorer URL not found for chainId ${chainId}`);
    }
    return `${explorerUrl}/tx/${txHash}`;
};
