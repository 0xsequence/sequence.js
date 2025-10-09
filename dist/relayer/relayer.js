export function isRelayer(relayer) {
    return ('isAvailable' in relayer &&
        'feeOptions' in relayer &&
        'relay' in relayer &&
        'status' in relayer &&
        'checkPrecondition' in relayer);
}
