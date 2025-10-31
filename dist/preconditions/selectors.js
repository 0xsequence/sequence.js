import { decodePreconditions } from './codec.js';
export function extractChainID(precondition) {
    if (!precondition) {
        return undefined;
    }
    try {
        const data = JSON.parse(precondition.data);
        return data.chainID ? Number(data.chainID) : undefined;
    }
    catch (e) {
        return undefined;
    }
}
export function extractSupportedPreconditions(preconditions) {
    if (!preconditions || preconditions.length === 0) {
        return [];
    }
    return decodePreconditions(preconditions);
}
export function extractNativeBalancePreconditions(preconditions) {
    if (!preconditions || preconditions.length === 0) {
        return [];
    }
    const decoded = decodePreconditions(preconditions);
    return decoded.filter((p) => p.type() === 'native-balance');
}
export function extractERC20BalancePreconditions(preconditions) {
    if (!preconditions || preconditions.length === 0) {
        return [];
    }
    const decoded = decodePreconditions(preconditions);
    return decoded.filter((p) => p.type() === 'erc20-balance');
}
