export function isValidPreconditionType(type) {
    return [
        'native-balance',
        'erc20-balance',
        'erc20-approval',
        'erc721-ownership',
        'erc721-approval',
        'erc1155-balance',
        'erc1155-approval',
    ].includes(type);
}
export function createPrecondition(precondition) {
    if (!precondition || typeof precondition.type !== 'string' || !isValidPreconditionType(precondition.type)) {
        throw new Error(`Invalid precondition object: missing or invalid 'type' property.`);
    }
    return precondition;
}
export function createIntentPrecondition(precondition, chainId) {
    const { type, ...data } = precondition;
    if (!isValidPreconditionType(type)) {
        throw new Error(`Invalid precondition type: ${type}`);
    }
    const intent = {
        type: type,
        data: data,
    };
    if (chainId !== undefined) {
        intent.chainId = chainId;
    }
    return intent;
}
//# sourceMappingURL=precondition.js.map